<?php

namespace App\Jobs;

use App\Support\RankService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Toggle (rank_system_active) veya eşikler değişince tüm rütbe önbelleğini arka planda yeniler.
 * Admin isteğini bloklamamak için kuyruğa atılır (worker yoksa `php artisan rank:refresh`).
 */
class RefreshAllRanksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;

    public function handle(): void
    {
        RankService::refreshAll();
    }
}
