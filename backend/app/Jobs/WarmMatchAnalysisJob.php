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

    public function middleware(): array
    {
        // BEST-EFFORT: aynı oda için çalışan bir pass varken gelen hamle-tetiği DÜŞÜRÜLÜR (dontRelease).
        // KÖK FIX (2026-10-21): eski releaseAfter(2)+retryUntil(120) "catch-up" tasarımı, 120sn'den UZUN
        // maçlarda ERKEN tetikleri sürekli release edip retryUntil süresi dolunca framework'ün
        // MaxAttemptsExceededException'ıyla failed_jobs'a düşürüyordu (admin alarmı). Warm PR'ı ETKİLEMEZ
        // (maç-sonu review telafi eder) -> best-effort bir iş ASLA paging etmemeli. dontRelease ile çakışan
        // tetik sessizce silinir (success, failed_jobs YOK). Tail: her hamle yeni tetik atar + buildMat
        // DAİMA en güncel state'i okur -> kilit boşalınca koşan ilk tetik en yeni hamleyi ısıtır; yalnız
        // maçın SON 1-2 hamlesi ısınmayabilir (maç-sonu review onları taze hesaplar — Fix 1 dedup bu
        // maliyeti zaten yarıya indirdi). 4 warm worker farklı odaları paralel ısıtır.
        return [(new WithoutOverlapping('warm:'.$this->roomCode))->expireAfter(300)->dontRelease()];
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
                // timeout=120 < worker --timeout=300: yavaş gnubg'de worker'ı SIGALRM ile öldürüp
                // MaxAttemptsExceededException'a (🔴 500 alarmı + failed_jobs) düşmek yerine curl-28 ile
                // sessizce vazgeç (best-effort; maç-sonu review telafi eder). Sağlıklı pass saniyeler sürer.
                $client->reviewMatch($mat, 2, null, $this->roomCode, 120);
            }
        } catch (\Throwable $e) {
            Log::debug('warm reviewMatch hata (bastırıldı)', ['room' => $this->roomCode, 'err' => $e->getMessage()]);
        }
    }
}
