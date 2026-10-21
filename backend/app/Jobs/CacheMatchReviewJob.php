<?php

namespace App\Jobs;

use App\Models\MatchResult;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Maç bitince hamle-hamle gnubg review'ini (Analiz ekranının yediği LogEntry[] + alternatifler)
 * ARKA PLANDA hesaplayıp match_results.gnubg_review'e ÖNDEN önbellekler -> "Analiz" İLK açılışta
 * bile anında gelir (on-demand ~20sn beklemez). On-demand yol (AuthController::matchGnubgReview)
 * AYNI kolonu okur/yazar; bu job yalnız önden ısıtır -> ikisi çakışırsa (WithoutOverlapping ayrı
 * anahtar) sorun yok: hangisi önce yazarsa diğeri "zaten önbellekli" görüp atlar.
 *
 * BEST-EFFORT (tries=1, FIRLATMAZ): gnubg down/başarısızsa sessizce vazgeçer -> failed_jobs'a
 * DÜŞMEZ (bu projede tekrar eden dert). Precompute kaçarsa kullanıcı ilk tıklamada ~20sn bekler
 * ama o tıklama da kolona yazar -> ikinci açılış yine anında. Yani kayıp yalnız "ilk açılış hızı".
 */
class CacheMatchReviewJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 600; // reviewMatch ağır (~saniyeler)

    public function __construct(public int $matchResultId, public int $plies = 2, public bool $force = false)
    {
        // AYRI kuyruk: canlı PR/luck worker'ı ('default') ile yarışmasın; adanmış tavla-review-queue
        // worker'ı YALNIZ bunu işler (bkz deploy/tavla-review-queue.service). Tüm dispatch site'ları
        // (maç-sonu + tavla:review-warmup) otomatik buraya yönlenir.
        $this->onQueue('reviews');
    }

    /** Aynı maçın review'ini worker'lar arasında seri çalıştır; çakışırsa TEKRAR KUYRUĞA ALMA (drop). */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('match-review:'.$this->matchResultId))
                ->expireAfter(900)
                ->dontRelease(),
        ];
    }

    public function handle(?GnuBgClient $gnubg = null): void
    {
        if (! Schema::hasColumn('match_results', 'gnubg_review')) {
            return; // kolon yok (migrate bekliyor) -> sessiz geç
        }
        $mr = MatchResult::find($this->matchResultId);
        if (! $mr || empty($mr->log)) {
            return; // analiz edilecek log yok (online/PvP boş sarmalayıcı vb.)
        }
        if (! $this->force && $this->plies === 2 && ! empty($mr->gnubg_review)) {
            return; // zaten önbellekli (on-demand ya da önceki job yazmış). force=true -> yeniden üret
            // (ör. skor-farkında küp analizi backfill'i: eski review 0-0 skorunda hesaplanmıştı).
        }
        $client = $gnubg ?? app(GnuBgClient::class);
        if (! $client->analyzeHealthy()) {
            return; // gnubg DOWN -> mezar taşı KOYMA; warmup/on-demand gnubg dönünce tekrar dener.
        }
        // MEZAR TAŞI (warmup döngü kalkanı): gnubg ERİŞİLEBİLİRKEN review üretilemezse (bozuk log /
        // boş mat / gnubg non-ok) gnubg_review_at'i set et ki tavla:review-warmup imleci İLERLESİN
        // (aynı analiz-dışı maçları sonsuza dek yeniden denemesin). gnubg_review NULL kalır -> on-demand
        // yol (controller gnubg_review'e bakar, _at'e DEĞİL) kullanıcı tıklarsa yine dener. gnubg DOWN
        // durumu yukarıda ele alındı (mezar taşı yok) -> outage'da yanlışlıkla gömülmez.
        $tombstone = function () use ($mr) {
            if ($this->plies === 2 && Schema::hasColumn('match_results', 'gnubg_review_at')) {
                MatchResult::where('id', $mr->id)->update(['gnubg_review_at' => now()]);
            }
        };
        try {
            $mat = $mr->matText();
        } catch (\Throwable $e) {
            Log::warning('review önbellek mat-build hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);
            $tombstone();

            return;
        }
        if (trim((string) $mat) === '') {
            $tombstone();

            return;
        }
        // affinity=room_code: maç-İÇİ warm ile AYNI instance -> gnubg review eval cache'i (gid bazlı)
        // paylaşılır -> warm ısıttıysa bu çağrı cache hit'le ~anında döner (maç 6J8YL 52s -> ~saniye).
        $res = $client->reviewMatch($mat, $this->plies, null, $mr->room_code ?: null);
        if (! is_array($res) || empty($res['ok'])) {
            Log::warning('review önbellek: gnubg review başarısız (yok sayildi)', ['id' => $mr->id]);
            $tombstone();

            return; // best-effort: on-demand yol tekrar dener
        }
        // Yalnız varsayılan plies(2) sonucu on-demand ile aynı kolona önbelleklenir.
        if ($this->plies === 2) {
            // DEDUPE (perf + GÜÇ): reviewMatch çıktısı tüm-maç = odanın İKİ satırı için BİREBİR AYNI
            // (matText() oda match_moves'tan türer, oyuncuya bağlı değil). Eskiden her satır yalnız KENDİ
            // gnubg_review'ini yazıyordu -> iki oyuncu rapor edince kardeş satırın guard'ı (yukarı:
            // !empty gnubg_review) TUTMUYORDU -> AYNI ağır reviewMatch + ardından AYNI Snowie analyzeMatch
            // oda başına 2 KEZ koşuyordu (tek review worker'ını seri boğup PR'ı geciktiren asıl israf;
            // bkz YZVSQ/YNCJT burst). Artık İKİ satıra da yaz -> kardeşin CacheMatchReviewJob'u guard'a
            // takılıp ANINDA atlar (Snowie'yi de tekrar dispatch ETMEZ; Snowie zaten tek çağrıda iki satırı
            // yazar). Bitiş DB durumu AYNI, gnubg yükü ~yarı. room_code yoksa (pvb/bot) yalnız kendi satırı.
            $enc = json_encode($res);
            // DEADLOCK KALKANI (2026-10-22): "where room_code" İKİ satırı TEK statement'ta kilitler;
            // aynı anda odanın iki satırını farklı sırada güncelleyen başka aktörlerle (AnalyzeMatchPrJob
            // opponent_pr senkronu, AnalyzeMatchSnowieJob, writePrFromReview döngüsü, eşzamanlı on-demand
            // review) InnoDB deadlock (40001/1213) olabiliyordu. Fix1 ÖNCESİ bu job yalnız KENDİ satırını
            // (where id) kilitliyordu -> deadlock yoktu. tries=1 best-effort olduğundan deadlock iş'i
            // failed_jobs'a düşürüp ALARM atıyordu. DB::transaction(...,5) deadlock'ta OTOMATİK retry eder
            // (küçük in-memory update -> ucuz). Son çare başarısızsa YUT: gnubg_review yazılmaz -> kardeş
            // guard'a takılmaz, review'u tekrar üretir (eski davranış) + on-demand telafi eder (zararsız).
            try {
                DB::transaction(function () use ($mr, $enc) {
                    $target = ! empty($mr->room_code)
                        ? MatchResult::where('room_code', $mr->room_code)
                        : MatchResult::where('id', $mr->id);
                    $target->update([
                        'gnubg_review' => $enc,
                        'gnubg_review_at' => now(),
                    ]);
                }, 5);
            } catch (\Throwable $e) {
                Log::warning('review gnubg_review yazımı başarısız (deadlock/retry tükendi, yok sayıldı; on-demand telafi eder)', ['id' => $mr->id, 'err' => $e->getMessage()]);
            }
            Log::info('review önden önbelleğe alındı', ['id' => $mr->id, 'decisions' => $res['decisions'] ?? null]);
            // PR'ı REVIEW'DAN türet (provisional) -> buggy per-pozisyon cubePr'ı devreden çıkar.
            $this->writePrFromReview($mr, is_array($res['log'] ?? null) ? $res['log'] : []);
            // OTORİTER PR = gnubg Snowie (XG-birebir). Review-log equity-toplamı match-play'de şişiyor;
            // ayrı /analyzematch ile Snowie PR'ı yazılır (provisional değeri EZER). Best-effort; gnubg
            // down/başarısızsa review-log değeri kalır. Bkz AnalyzeMatchSnowieJob + GnubgSnowieService.
            // KUYRUK = beni doğuran işin kuyruğu: backfill (reviews-bulk) -> snowie de reviews-bulk'ta
            // kalsın; yoksa 3 backfill worker'ı ~9/dk snowie işini CANLI 'reviews'e sızdırıp tek canlı
            // worker'ı boğuyordu (reviews 3->400, 2026-10-18). Böylece izolasyon tam: canlı 'reviews'
            // yalnız canlı maç-sonu snowie'yi görür. $this->job yoksa (sync/test) 'reviews' varsayılanı.
            \App\Jobs\AnalyzeMatchSnowieJob::dispatch($mr->id)
                ->onQueue($this->job?->getQueue() ?: 'reviews');
        }
    }

    /**
     * PR/küp PR'ı reviewMatch log'undan (tam .mat = SUNUCU match_moves) türetip odadaki İKİ satıra
     * (self + kardeş) renk-eşlemeli yaz. reviewMatch DOĞRU; per-pozisyon cubePr küp kararlarında runtime
     * hatalıydı (EU6CD). Böylece tüm raporlar yalnız sunucu verisiyle + DOĞRU (kullanıcı direktifi).
     */
    private function writePrFromReview(MatchResult $mr, array $reviewLog): void
    {
        if ($reviewLog === [] || empty($mr->room_code) || ! Schema::hasColumn('match_results', 'gnubg_pr')) {
            return;
        }
        try {
            $orch = app(\App\Services\Analysis\AnalysisOrchestrator::class);
            $prW = $orch->prFromReviewLog($reviewLog, 'white');
            $prB = $orch->prFromReviewLog($reviewLog, 'black');
            foreach (MatchResult::where('room_code', $mr->room_code)->get() as $row) {
                $hc = $row->analysisHc();
                if (! in_array($hc, ['white', 'black'], true)) {
                    continue;
                }
                $self = $hc === 'white' ? $prW : $prB;
                $opp = $hc === 'white' ? $prB : $prW;
                // SAHTE-0 KALKANI + MİN-KARAR KAPISI: skorlanan karar MIN_PR_DECISIONS'tan azsa maç PR'ı
                // istatistiksel gürültü (2-3 kararda 300+) -> gnubg_pr/pr=null ("—"), career'a katılmaz.
                // round(0)=0 YAZMA; meşru "—" satırını 0'a çevirmesin. checker/cube ayrıca saklanır.
                $min = \App\Services\Analysis\AnalysisOrchestrator::MIN_PR_DECISIONS;
                $selfPr = ($self['decisions'] ?? 0) >= $min ? round($self['pr'], 2) : null;
                $oppPr = ($opp['decisions'] ?? 0) >= $min ? round($opp['pr'], 2) : null;
                // KÖK FIX (kalıcı "—" + kariyer maç sayısı yarılanması): review bir tarafı skorlayamazsa
                // (p2/siyah .mat sağ-sütun çıkarımı boş -> decisions<min -> null) o tarafın PR kolonlarını
                // NULL ile EZME. Eskiden koşulsuz yazılıyordu -> AnalyzeMatchPrJob'ın DOĞRU per-pozisyon
                // değeri silinip mezar taşı (gnubg_pr_at) konuyordu -> heal bir daha denemezdi -> KALICI
                // "—". Artık review SALT-EKLEYİCİ: yalnız GERÇEKTEN skorladığı tarafı yazar; skorlayamadığı
                // taraf per-pozisyon değerinde kalır (bu tekrar eden backfill'in kök nedeniydi).
                $upd = [];
                if ($selfPr !== null) {
                    $upd['gnubg_pr'] = $selfPr;
                    $upd['pr'] = $selfPr;
                    $upd['pr_equity_lost'] = round($self['equity_lost'], 4);
                    $upd['pr_decisions'] = $self['decisions'];
                    $upd['gnubg_checker_pr'] = $self['checker_pr'] !== null ? round($self['checker_pr'], 2) : null;
                    $upd['gnubg_cube_pr'] = $self['cube_pr'] !== null ? round($self['cube_pr'], 2) : null;
                    $upd['cube_equity_lost'] = round((float) ($self['cube_equity_lost'] ?? 0), 4); // kariyer küp PR için
                    $upd['cube_decisions'] = (int) ($self['cube_decisions'] ?? 0);
                    $upd['gnubg_pr_at'] = now();
                }
                if ($oppPr !== null) {
                    $upd['gnubg_opponent_pr'] = $oppPr;
                    $upd['opponent_pr'] = $oppPr; // legacy fallback kolonu = otoriter opp PR (drift birikmesin)
                    $upd['gnubg_opponent_checker_pr'] = $opp['checker_pr'] !== null ? round($opp['checker_pr'], 2) : null;
                    $upd['gnubg_opponent_cube_pr'] = $opp['cube_pr'] !== null ? round($opp['cube_pr'], 2) : null;
                }
                if ($upd !== []) {
                    MatchResult::where('id', $row->id)->update($upd);
                }
            }
        } catch (\Throwable $e) {
            Log::warning('review-based PR yazımı hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);
        }
    }
}
