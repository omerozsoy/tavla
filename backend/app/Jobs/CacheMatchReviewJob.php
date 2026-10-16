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
        $res = $client->reviewMatch($mat, $this->plies);
        if (! is_array($res) || empty($res['ok'])) {
            Log::warning('review önbellek: gnubg review başarısız (yok sayildi)', ['id' => $mr->id]);
            $tombstone();

            return; // best-effort: on-demand yol tekrar dener
        }
        // Yalnız varsayılan plies(2) sonucu on-demand ile aynı kolona önbelleklenir.
        if ($this->plies === 2) {
            MatchResult::where('id', $mr->id)->update([
                'gnubg_review' => json_encode($res),
                'gnubg_review_at' => now(),
            ]);
            Log::info('review önden önbelleğe alındı', ['id' => $mr->id, 'decisions' => $res['decisions'] ?? null]);
            // PR'ı REVIEW'DAN türet (provisional) -> buggy per-pozisyon cubePr'ı devreden çıkar.
            $this->writePrFromReview($mr, is_array($res['log'] ?? null) ? $res['log'] : []);
            // OTORİTER PR = gnubg Snowie (XG-birebir). Review-log equity-toplamı match-play'de şişiyor;
            // ayrı /analyzematch ile Snowie PR'ı yazılır (provisional değeri EZER). Best-effort; gnubg
            // down/başarısızsa review-log değeri kalır. Bkz AnalyzeMatchSnowieJob + GnubgSnowieService.
            \App\Jobs\AnalyzeMatchSnowieJob::dispatch($mr->id);
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
                MatchResult::where('id', $row->id)->update([
                    'gnubg_pr' => $selfPr,
                    'gnubg_checker_pr' => $self['checker_pr'] !== null ? round($self['checker_pr'], 2) : null,
                    'gnubg_cube_pr' => $self['cube_pr'] !== null ? round($self['cube_pr'], 2) : null,
                    'cube_equity_lost' => round((float) ($self['cube_equity_lost'] ?? 0), 4), // kariyer küp PR için
                    'cube_decisions' => (int) ($self['cube_decisions'] ?? 0),
                    'pr_equity_lost' => round($self['equity_lost'], 4),
                    'pr_decisions' => $self['decisions'],
                    'pr' => $selfPr,
                    'gnubg_opponent_pr' => $oppPr,
                    'opponent_pr' => $oppPr, // legacy fallback kolonu = otoriter opp PR (drift birikmesin)
                    'gnubg_opponent_checker_pr' => $opp['checker_pr'] !== null ? round($opp['checker_pr'], 2) : null,
                    'gnubg_opponent_cube_pr' => $opp['cube_pr'] !== null ? round($opp['cube_pr'], 2) : null,
                    'gnubg_pr_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('review-based PR yazımı hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);
        }
    }
}
