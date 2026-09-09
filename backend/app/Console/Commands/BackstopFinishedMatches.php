<?php

namespace App\Console\Commands;

use App\Models\Room;
use App\Support\MatchBackstop;
use Illuminate\Console\Command;

/**
 * SUNUCU-OTORİTER YEDEK SÜPÜRME: tamamlanmış online maçlarda istemcisi reportRating'i
 * kalıcılaştıramamış oyuncuların match_results satırını sunucuda tamamlar (bkz MatchBackstop).
 * Böylece "kazandığı halde sekmeyi kapatan" gibi durumlarda maç, HER İKİ oyuncunun
 * "Maç Analizleri" listesinde de görünür.
 *
 * GRACE (--minutes): canlı istemcinin ZENGİN (log/PR'lı) satırı önce yazsın diye yalnız
 * `--minutes` dakikadan eski maçlara bakar. LOOKBACK (--days): odalar ~1 gün sonra silindiği
 * için yalnız hâlâ çözülebilen taze odalar taranır. Zamanlayıcıdan periyodik çağrılır.
 */
class BackstopFinishedMatches extends Command
{
    protected $signature = 'matches:backstop-finished {--minutes=2 : Bu kadar dakikadan eski maçlara bak (grace)} {--days=2 : Bu kadar günden yeni odaları tara}';

    protected $description = 'Tamamlanmış online maçlarda eksik oyuncu match_results satırlarını sunucuda tamamlar.';

    public function handle(): int
    {
        $graceMin = max(0, (int) $this->option('minutes'));
        $days = max(1, (int) $this->option('days'));
        $before = now()->subMinutes($graceMin);
        $after = now()->subDays($days);

        $written = 0;
        $scanned = 0;

        // Aday odalar: zaman penceresinde + oynanabilir/bitmiş durumda (bekleyen/eşleşme değil).
        // Sonuç KESİNLİĞİNİ RoomResult::resolve belirler -> yarım kalan maça satır açılmaz.
        Room::query()
            ->whereIn('status', ['playing', 'finished'])
            ->where('updated_at', '<', $before)
            ->where('updated_at', '>', $after)
            ->where(function ($q) {
                $q->whereNotNull('p1_user_id')->orWhereNotNull('p2_user_id');
            })
            ->orderBy('id')
            ->chunkById(200, function ($rooms) use (&$written, &$scanned) {
                foreach ($rooms as $room) {
                    $scanned++;
                    try {
                        $written += MatchBackstop::ensure($room);
                    } catch (\Throwable $e) {
                        \Illuminate\Support\Facades\Log::warning('matches:backstop-finished oda atlandı', [
                            'room' => $room->code, 'err' => $e->getMessage(),
                        ]);
                    }
                }
            });

        $this->info("Backstop: {$scanned} oda tarandı, {$written} eksik satır yazıldı.");

        return self::SUCCESS;
    }
}
