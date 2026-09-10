<?php

namespace App\Console\Commands;

use App\Services\CareerPrService;
use Illuminate\Console\Command;

/**
 * Career PR (PR Sıralaması) aggregate'lerini TÜM oyuncular icin yeniden kurar.
 * Eski analiz edilmis maçlar dahil (gerekirse --backfill ile log'dan pr totalleri doldurulur).
 * Chunk'li -> production'da timeout/memory güvenli.
 *
 *   php artisan careerpr:rebuild              # sadece aggregate'leri yeniden hesapla
 *   php artisan careerpr:rebuild --backfill   # once eski maçlarin pr totallerini log'dan doldur
 */
class RebuildCareerPr extends Command
{
    protected $signature = 'careerpr:rebuild {--backfill : Eski maçlarda eksik pr_equity_lost/pr_decisions değerlerini log’dan doldur}';

    protected $description = 'Career PR (PR Sıralaması) aggregate’lerini tüm oyuncular için yeniden kurar';

    public function handle(CareerPrService $svc): int
    {
        if ($this->option('backfill')) {
            $this->info('Eski maçların PR totalleri log’dan dolduruluyor…');
            $n = $svc->backfillTotalsFromLog();
            $this->info("Backfill: {$n} maç güncellendi.");
        }

        $this->info('Career PR aggregate’leri yeniden hesaplanıyor…');
        $c = $svc->recalcAll();
        $this->info("Tamamlandı: {$c} oyuncu güncellendi.");

        return self::SUCCESS;
    }
}
