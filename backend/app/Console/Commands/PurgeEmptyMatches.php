<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Analizi olmayan mac kayitlarini siler.
 *
 * "Analizsiz" = log kolonu NULL ya da bos sarmalayici ({"hc":..,"log":[]} ~<=40 karakter).
 * Bunlar cogunlukla online/PvP maclar (hamle analizi kaydedilmemis). Gercek analiz iceren
 * (AI/Tek Oyun) maclar KORUNUR. Kullanici rating/wins/coins User modelinde tutuldugu icin
 * bu silme istatistik bakiyesini bozmaz; yalnizca gecmis analiz satirlarini kaldirir.
 *
 * Kullanim (sunucuda):
 *   php artisan tavla:purge-empty-matches --dry-run   # sadece say
 *   php artisan tavla:purge-empty-matches             # sil
 *   php artisan tavla:purge-empty-matches --user=42   # yalniz belirli kullanici
 */
class PurgeEmptyMatches extends Command
{
    protected $signature = 'tavla:purge-empty-matches {--dry-run : Sadece say, silme} {--user= : Yalniz bu user_id}';

    protected $description = 'Analizi olmayan (bos/null log) mac kayitlarini siler';

    public function handle(): int
    {
        if (! Schema::hasColumn('match_results', 'log')) {
            $this->error('match_results.log kolonu yok — silme yapilmadi.');

            return self::FAILURE;
        }

        $base = function () {
            $q = DB::table('match_results')->where(function ($w) {
                // Analizsiz: log NULL veya bos sarmalayici ({"hc":"white","log":[]} ~ 23-40 char)
                $w->whereNull('log')->orWhereRaw('CHAR_LENGTH(log) <= 40');
            });
            if ($this->option('user')) {
                $q->where('user_id', (int) $this->option('user'));
            }

            return $q;
        };

        $count = $base()->count();
        $this->info("Analizsiz (silinecek) mac sayisi: {$count}");

        if ($this->option('dry-run')) {
            $this->line('dry-run: hicbir kayit silinmedi.');

            return self::SUCCESS;
        }

        if ($count === 0) {
            $this->line('Silinecek kayit yok.');

            return self::SUCCESS;
        }

        $deleted = $base()->delete();
        $this->info("Silindi: {$deleted} mac kaydi.");

        return self::SUCCESS;
    }
}
