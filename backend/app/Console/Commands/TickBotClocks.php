<?php

namespace App\Console\Commands;

use App\Http\Controllers\RoomController;
use App\Models\Room;
use Illuminate\Console\Command;

/**
 * BOT MAÇI SAATİNİ SUNUCUDA İLERLET: Sunucu-otoriter saat "pull" mantığıyla çalışır — süre
 * yalnızca oda POLL edildiğinde (MatchClock::tick) hesaplanır. Online maçta rakibin sekmesi
 * ~1.5sn'de bir poll ettiği için sen arka plandayken bile saatin akar ve süren bittiğinde
 * timeout İLAN EDİLİR. Bot maçında ise rakip = bot, HİÇ poll etmez; tek insan da sekmeyi arka
 * plana alırsa (poll kısılır/durur) saati soracak kimse kalmaz -> süre gerçekte bitse de timeout
 * ilan edilmez, maç donuk "playing"de asılı kalır ("süre bitmemiş" bug'ı).
 *
 * Bu iş, oynanan bot odalarını periyodik olarak tick'ler: süre/AFK bittiyse ya da insan terk
 * ettiyse (presence) MatchClock kararı verir ve applyClockEnd maçı finalize eder. Bot odası
 * 'friendly' olduğu için kaybeden insana rating/Elo cezası YAZILMAZ (yalnız maç düzgün biter).
 * tickClock süre bitmediğinde IDEMPOTENT'tir (yazma yok) -> aktif oynanan odalar için maliyetsiz.
 *
 * NOT: Sunucuda "* * * * * php artisan schedule:run" cron'u tanımlı OLMALI; yoksa çalışmaz.
 */
class TickBotClocks extends Command
{
    protected $signature = 'matches:tick-bots {--days=1 : Bu kadar günden yeni bot odalarını tara}';

    protected $description = 'Oynanan bot maçlarının saatini sunucuda ilerletir (rakip poll etmediği için süre/terk timeout\'u kendiliğinden ilan edilsin).';

    public function handle(RoomController $rooms): int
    {
        $days = max(1, (int) $this->option('days'));
        $after = now()->subDays($days);

        $scanned = 0;
        $ended = 0;

        Room::query()
            ->where('status', 'playing')
            ->where('bot', true)
            ->whereNotNull('clock') // açılış oynanmadan saat yok -> boş odaları yükleme
            ->where('created_at', '>', $after)
            ->orderBy('id')
            ->chunkById(200, function ($chunk) use ($rooms, &$scanned, &$ended) {
                foreach ($chunk as $room) {
                    $scanned++;
                    try {
                        // slot=null: seen damgası YAZMA (yoksa botu insan poll'üymüş gibi canlı
                        // tutar). Süre/AFK/presence bittiyse tickClock -> applyClockEnd finalize eder.
                        $rooms->tickClock($room, null);
                        if ($room->status === 'finished') {
                            $ended++;
                        }
                    } catch (\Throwable $e) {
                        \Illuminate\Support\Facades\Log::warning('matches:tick-bots oda atlandı', [
                            'room' => $room->code, 'err' => $e->getMessage(),
                        ]);
                    }
                }
            });

        $this->info("tick-bots: {$scanned} bot maçı tarandı, {$ended} saatten sonuçlandı.");

        return self::SUCCESS;
    }
}
