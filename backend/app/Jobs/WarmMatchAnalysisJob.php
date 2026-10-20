<?php

namespace App\Jobs;

use App\Models\MatchMove;
use App\Models\Room;
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

    public function handle(?GnuBgClient $gnubg = null): void
    {
        $client = $gnubg ?? app(GnuBgClient::class);
        if (! $client->analyzeHealthy()) {
            return; // servis yoksa ısınmayı atla (maç-sonu job + heal telafi eder)
        }
        if (! MatchMove::existsForRoom($this->roomCode)) {
            return;
        }
        // DOĞRU MOTORU ISIT: GÖSTERİLEN maç-sonu PR reviewMatch'ten gelir (reviewAuthoritative). Eski warm
        // per-pozisyon checkerPr/cubePr ısıtıyordu -> reviewMatch onu EZDİĞİNDEN tamamen BOŞAYDI (maç
        // 6J8YL 52s). Artık maç-İÇİ .mat'ı reviewMatch'ten geçirip gnubg'nin (gid bazlı) review eval
        // cache'ini ISITIYORUZ. Maç bitince CacheMatchReviewJob AYNI .mat'ı AYNI instance'tan (affinity=
        // room_code) review'ler -> ısınmış pozisyonlar cache hit (~0.03s) -> yalnız son hamleler soğuk.
        $room = Room::where('code', $this->roomCode)->first(['target', 'stake']);
        $ml = max(1, (int) ($room->target ?? 1));
        // isMoney = matText ile AYNI mantık (küçük hedef + bahis = money-session) -> .mat gid'leri hizalı.
        $isMoney = (int) ($room->target ?? 0) <= 1 && (int) ($room->stake ?? 0) > 0;
        try {
            $mat = MatchMove::buildMat($this->roomCode, ['matchLength' => $ml, 'isMoney' => $isMoney]);
            if (trim($mat) !== '') {
                // affinity=room_code -> maç-sonu review ile AYNI instance -> eval cache paylaşılır.
                $client->reviewMatch($mat, 2, null, $this->roomCode);
            }
        } catch (\Throwable $e) {
            Log::debug('warm reviewMatch hata (bastırıldı)', ['room' => $this->roomCode, 'err' => $e->getMessage()]);
        }
    }
}
