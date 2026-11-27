<?php

namespace App\Console\Commands;

use App\Support\RankService;
use Illuminate\Console\Command;

/**
 * Tüm oyuncuların efektif rütbe önbelleğini (users.rank_key) yeniden hesaplar.
 * Toggle (rank_system_active) AÇIK/KAPALI değişince veya eşikler güncellenince çalıştır.
 */
class RefreshRanks extends Command
{
    protected $signature = 'rank:refresh';

    protected $description = 'Efektif rütbe (rating+PR+EP) önbelleğini tüm oyuncular için yeniden hesaplar';

    public function handle(): int
    {
        $this->info('Rütbe önbelleği yenileniyor (aktif='.(RankService::active() ? 'evet' : 'hayır').')...');
        $n = RankService::refreshAll();
        $this->info("Tamam: {$n} oyuncu.");

        return self::SUCCESS;
    }
}
