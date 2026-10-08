<?php

namespace App\Console\Commands;

use App\Models\Sponsor;
use App\Support\ImageOptimizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * MEVCUT sponsor logolarını retroaktif olarak sabit KARE şeffaf tuvale pad'ler (upload-anı
 * padOnUpload yalnız YENİ yüklemelere uygulanır). Her logoyu kırpar (boş kenar) + ortalar ->
 * tüm logolar eşit boyutta görünür. Eski dosya silinir, DB'deki logo yolu güncellenir.
 * Idempotent: ikinci koşuda zaten kare logoyu yine normalize eder (zararsız).
 */
class PadSponsorLogos extends Command
{
    protected $signature = 'sponsors:pad-logos
        {--size=400 : Kare tuval kenarı (px)}
        {--inner=0.9 : Logonun tuval içinde kaplayacağı oran (0-1)}
        {--dry-run : Yazmadan ne yapılacağını göster}';

    protected $description = 'Mevcut sponsor logolarını eşit kare tuvale pad\'ler (boş kenarı kırpar, ortalar).';

    public function handle(ImageOptimizer $optimizer): int
    {
        $size = max(32, (int) $this->option('size'));
        $inner = max(0.1, min(1.0, (float) $this->option('inner')));
        $dry = (bool) $this->option('dry-run');

        $sponsors = Sponsor::whereNotNull('logo')->where('logo', '!=', '')->get();
        if ($sponsors->isEmpty()) {
            $this->info('Logolu sponsor yok.');

            return self::SUCCESS;
        }

        $done = 0;
        $failed = 0;
        foreach ($sponsors as $s) {
            $old = $s->logo;
            if ($dry) {
                $this->line("  [dry] {$s->name}: {$old}");
                $done++;

                continue;
            }

            $new = $optimizer->padStored('uploads', $old, $size, $inner);
            if ($new === null) {
                $this->warn("  [hata] {$s->name}: pad edilemedi ({$old})");
                $failed++;

                continue;
            }
            $s->logo = $new;
            $s->save();
            if ($new !== $old) {
                Storage::disk('uploads')->delete($old); // eski dosyayı temizle
            }
            $this->line("  [ok] {$s->name}: {$old} -> {$new}");
            $done++;
        }

        $this->info(sprintf('%d logo %s%s.', $done, $dry ? 'pad EDİLECEK (dry-run)' : 'pad edildi', $failed > 0 ? ", {$failed} başarısız" : ''));

        return self::SUCCESS;
    }
}
