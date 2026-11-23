<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\User;
use App\Models\UserStat;
use App\Services\Achievements\AchievementService;
use Illuminate\Console\Command;

/**
 * Günlük liderlik "reign" sayacı: o anki 1. sıradaki (liderlik tablosu lideri) oyuncunun
 * user_stats.reign_days değerini 1 artırır ve rozetlerini değerlendirir
 * (Taht=7, Hanedan=30 TOPLAM gün).
 *
 * TOPLAM gün (ardışık DEĞİL) -> taht el değiştirince sayaç SIFIRLANMAZ; herkes kendi
 * topladığı günü korur. İleri-dönük: geçmiş günlük 1.lik verisi olmadığı için backfill YOK,
 * bu komut çalıştığı günden itibaren sayar.
 *
 * 1. sıra ölçütü leaderboard ile AYNI (LeaderboardController::topRanks): sistem/silinmiş
 * hesaplar hariç, rating DESC, eşitlikte wins DESC.
 *
 * Günde BİR kez (routes/console.php dailyAt). Setting `reign_tick_date` aynı gün çift-sayımı önler.
 */
class ReignTick extends Command
{
    protected $signature = 'tavla:reign-tick {--force : Aynı gün zaten işlenmiş olsa bile çalıştır}';

    protected $description = 'Günlük liderlik lideri (#1) reign_days sayacını artırır (Taht/Hanedan rozetleri)';

    public function handle(): int
    {
        $today = now()->toDateString();
        if (! $this->option('force') && Setting::get('reign_tick_date', '') === $today) {
            $this->info("Bugün ({$today}) zaten işlendi, atlandı (--force ile zorla).");

            return self::SUCCESS;
        }

        $top = User::query()->where('is_system', false)->notDeleted()
            ->orderByDesc('rating')->orderByDesc('wins')->first();
        if (! $top) {
            $this->warn('Sıralanacak oyuncu yok.');

            return self::SUCCESS;
        }

        $stat = UserStat::forUser($top->id);
        $stat->increment('reign_days');
        $stat->refresh();

        $new = app(AchievementService::class)->evaluate($top);

        Setting::put('reign_tick_date', $today);
        $this->info("#1 = {$top->nickname} (id {$top->id}), reign_days = {$stat->reign_days}, yeni rozet: ".count($new));

        return self::SUCCESS;
    }
}
