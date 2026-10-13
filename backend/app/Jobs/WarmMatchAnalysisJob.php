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

    public int $tries = 1; // best-effort; başarısızsa maç-sonu job zaten telafi eder

    public int $timeout = 300;

    public function __construct(public string $roomCode) {}

    public function middleware(): array
    {
        // Aynı oda için üst üste gelen hamle-tetiklerini AT (release etme) -> önbellek zaten bir
        // sonraki tetikte güncellenir; kuyruk şişmez.
        return [(new WithoutOverlapping('warm:'.$this->roomCode))->expireAfter(300)->dontRelease()];
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
