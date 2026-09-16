<?php

namespace App\Console\Commands;

use App\Http\Controllers\RoomController;
use App\Models\Room;
use Illuminate\Console\Command;

/**
 * BAYAT "playing" ODA SÜPÜRME: kimsenin poll etmediği (oyuncu da izleyici de yok) yarım kalan /
 * terk edilmiş online odaları 'finished' işaretler. Aksi halde böyle bir oda `cleanupStale`
 * silene dek (~1 gün) 'playing'de asılı kalır ve:
 *   - "Devam Eden Maç" banner'ında HAYALET olarak (oyuncu tekrar poll edince) görünür,
 *   - onu izleyen (Spectate) donmuş tahtada sonuçsuz kalır.
 *
 * GRACE (--min): canlı maç ~1.5sn'de bir poll ettiği için updated_at asla bayatlamaz; yalnız
 * --min dakikadan uzun süredir DOKUNULMAMIŞ odalar (gerçekten ölü) taranır -> canlı maç asla
 * yanlışlıkla bitirilmez. LOOKBACK (--days): odalar ~1 gün sonra silindiği için pencere dar.
 */
class ReapStaleRooms extends Command
{
    protected $signature = 'matches:reap-stale {--min=3 : En az bu kadar dk dokunulmamış odalar (grace)} {--days=1 : Bu kadar günden yeni odaları tara}';

    protected $description = 'Bayat (kimse poll etmiyor) "playing" online odaları finalize eder (hayalet Devam Eden Maç + izleyici donması fix).';

    public function handle(RoomController $rooms): int
    {
        $min = max(1, (int) $this->option('min'));
        $days = max(1, (int) $this->option('days'));
        $before = now()->subMinutes($min);
        $after = now()->subDays($days);

        $reaped = 0;
        $scanned = 0;

        Room::query()
            ->where('status', 'playing')
            ->where('updated_at', '<', $before)
            ->where('updated_at', '>', $after)
            ->orderBy('id')
            ->chunkById(200, function ($chunk) use ($rooms, &$reaped, &$scanned) {
                foreach ($chunk as $room) {
                    $scanned++;
                    try {
                        if ($rooms->reapStaleRoom($room)) {
                            $reaped++;
                        }
                    } catch (\Throwable $e) {
                        \Illuminate\Support\Facades\Log::warning('matches:reap-stale oda atlandı', [
                            'room' => $room->code, 'err' => $e->getMessage(),
                        ]);
                    }
                }
            });

        $this->info("Reap: {$scanned} bayat oda tarandı, {$reaped} finalize edildi.");

        return self::SUCCESS;
    }
}
