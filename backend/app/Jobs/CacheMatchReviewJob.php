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

    public function __construct(public int $matchResultId, public int $plies = 2)
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
        if ($this->plies === 2 && ! empty($mr->gnubg_review)) {
            return; // zaten önbellekli (on-demand ya da önceki job yazmış)
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
        }
    }
}
