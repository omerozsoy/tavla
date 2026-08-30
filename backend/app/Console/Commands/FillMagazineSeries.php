<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Serisi (organizer) bos olan magazin videolarinin seri alanina 'Videolar' yazar.
 * Boylece admin "Seri" hucresi bos gorunmez ve frontend ayni baslik altinda toplar.
 *
 * Plesk Artisan kutusunda ("php artisan" onekini kutu ekler):
 *   magazine:fill-series
 */
class FillMagazineSeries extends Command
{
    protected $signature = 'magazine:fill-series {--label=Videolar : Bos serilere yazilacak etiket}';

    protected $description = 'Serisi bos magazin videolarina seri etiketi yazar (varsayilan: Videolar)';

    public function handle(): int
    {
        $label = (string) $this->option('label');

        $updated = DB::table('contents')
            ->where('type', 'magazine')
            ->where(function ($q) {
                $q->whereNull('organizer')->orWhere('organizer', '');
            })
            ->update(['organizer' => $label]);

        $this->info("Guncellendi: {$updated} video -> seri '{$label}'.");

        return self::SUCCESS;
    }
}
