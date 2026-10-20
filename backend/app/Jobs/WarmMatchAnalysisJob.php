<?php

namespace App\Jobs;

use App\Models\MatchMove;
use App\Models\Room;
use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * #4 "düdükte hazır": maç SIRASINDA (her hamleden sonra) o ana kadarki kararları gnubg'de analiz
 * edip GnuBgClient önbelleğine (analyzeBackgroundBatch memoization) ISITIR. Maç bitince
 * AnalyzeMatchPrJob AYNI pozisyonları ister -> cache hit -> gnubg'ye hiç gitmez -> PR ~anında.
 *
 * GÜVENLİK: PR'ı YAZMAZ, hiçbir match_results kolonuna DOKUNMAZ. Sadece önbellek ısıtır. Isınma
 * eksik/yanlış olsa bile maç-sonu job gnubg'ye düşer (ıska) -> PR DEĞİŞMEZ. 'bulk' şeridinde (düşük
 * öncelik) -> başka maçın CANLI PR'ını geciktirmez. WithoutOverlapping -> hamle başına yığılmaz.
 */
class WarmMatchAnalysisJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 300;

    public function __construct(public string $roomCode) {}

    // CATCH-UP (maç kuyruğu ısınsın): çakışan tetik SİLİNMEZ, kısa süre sonra YENİDEN DENENİR ->
    // en güncel hamle daima birkaç saniyede ısınır, maç-sonu PR job'una yetişir. retryUntil ile
    // attempt sayacı DEVRE DIŞI (release'ler failed_jobs üretmez; kilit normalde saniyeler içinde
    // boşalıp iş TAMAMLANIR -> yalnız patolojik 2dk kilitlenmede expire olur). Böylece maçın SON
    // hamleleri de ısınır (eski dontRelease onları atıp maç-sonu 13sn taze hesaplamaya bırakıyordu).
    public function retryUntil(): \DateTimeInterface
    {
        return now()->addSeconds(120);
    }

    public function middleware(): array
    {
        // Aynı oda için üst üste gelen hamle-tetiklerini ~2sn sonra TEKRAR DENE (dontRelease DEĞİL):
        // çalışan pass bitince en yeni hamleyi kapsayan tetik hemen koşar -> kuyruk/tail güncel kalır.
        return [(new WithoutOverlapping('warm:'.$this->roomCode))->expireAfter(300)->releaseAfter(2)];
    }

    public function handle(AnalysisOrchestrator $orch, ?GnuBgClient $gnubg = null): void
    {
        if ($gnubg !== null && ! $gnubg->analyzeHealthy()) {
            return; // servis yoksa ısınmayı atla (maç-sonu job + heal telafi eder)
        }
        if (! MatchMove::existsForRoom($this->roomCode)) {
            return;
        }
        $log = MatchMove::buildLog($this->roomCode);
        if (empty($log)) {
            return;
        }
        $ml = (int) (Room::where('code', $this->roomCode)->value('target') ?? 0);

        // Maç-sonu PR job'u iki satırı da (her iki renk) analiz eder -> ikisini de ısıt. checkerPr/
        // cubePr analyzeBackgroundBatch'i çağırır -> sonuçlar içerik-hash'iyle önbelleğe girer.
        foreach (['white', 'black'] as $color) {
            try {
                $orch->checkerPr($log, $color, $ml, 2);
                $orch->cubePr($log, $color, $ml);
            } catch (\Throwable $e) {
                Log::debug('warm analiz hata (bastırıldı)', ['room' => $this->roomCode, 'color' => $color, 'err' => $e->getMessage()]);
            }
        }
    }
}
