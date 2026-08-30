<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Mac baglami olmayan (eski) Hata Gunlugu kayitlarini siler.
 *
 * "Eski" = opp, ai_level ve score_me kolonlarinin ucu de NULL. Bunlar
 * 2026_08_29 mac-baglami migration'indan onceki kayitlar; MiniBoard'da
 * "noContext" grubuna dusuyor ve dashboard'da baglamsiz gorunuyor.
 * Kullanici rating/coins User modelinde tutuldugu icin silme istatistik
 * bakiyesini bozmaz; yalnizca baglamsiz gecmis blunder satirlarini kaldirir.
 *
 * Kullanim (Plesk Artisan kutusunda, "php artisan" onekini kutu kendi ekler):
 *   tavla:purge-legacy-blunders --dry-run   # sadece say
 *   tavla:purge-legacy-blunders             # sil
 *   tavla:purge-legacy-blunders --user=42   # yalniz belirli kullanici
 */
class PurgeLegacyBlunders extends Command
{
    protected $signature = 'tavla:purge-legacy-blunders {--dry-run : Sadece say, silme} {--user= : Yalniz bu user_id}';

    protected $description = 'Mac baglami olmayan (eski) Hata Gunlugu kayitlarini siler';

    public function handle(): int
    {
        $base = function () {
            $q = DB::table('blunders')
                ->whereNull('opp')
                ->whereNull('ai_level')
                ->whereNull('score_me');
            if ($this->option('user')) {
                $q->where('user_id', (int) $this->option('user'));
            }

            return $q;
        };

        $count = $base()->count();
        $this->info("Baglamsiz (silinecek) blunder sayisi: {$count}");

        if ($this->option('dry-run')) {
            $this->line('dry-run: hicbir kayit silinmedi.');

            return self::SUCCESS;
        }

        if ($count === 0) {
            $this->line('Silinecek kayit yok.');

            return self::SUCCESS;
        }

        $deleted = $base()->delete();
        $this->info("Silindi: {$deleted} blunder kaydi.");

        return self::SUCCESS;
    }
}
