<?php

namespace App\Console\Commands;

use App\Models\TournamentAd;
use Illuminate\Console\Command;

/**
 * Mevcut banner gorsellerini optimize eder (kucult + WebP'ye sikistir). Yeni yuklemeler
 * TournamentAd::booted() icinde otomatik optimize edilir; bu komut GECMISTE yuklenmis
 * agir gorseller icindir. Idempotent: zaten optimize (kucuk WebP) gorseller degismez.
 *
 * Kullanim:
 *   php artisan banner:optimize
 *   php artisan banner:optimize --dry-run
 */
class OptimizeBanners extends Command
{
    protected $signature = 'banner:optimize {--dry-run : Yazmadan hangi gorsellerin kucultulecegini goster}';

    protected $description = 'Mevcut banner gorsellerini optimize et (kucult + WebP sikistirma)';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $ads = TournamentAd::query()->whereNotNull('image')->get();
        $saved = 0;
        $count = 0;

        foreach ($ads as $ad) {
            $old = $ad->image;
            $abs = public_path('uploads/'.ltrim($old, '/'));
            $before = is_file($abs) ? filesize($abs) : 0;

            if ($dry) {
                $this->line("#{$ad->id}  {$old}  (".$this->human($before).')');

                continue;
            }

            $new = TournamentAd::optimizeImage($old);
            if ($new === null || $new === $old) {
                continue;
            }

            $newAbs = public_path('uploads/'.ltrim($new, '/'));
            $after = is_file($newAbs) ? filesize($newAbs) : 0;
            $ad->updateQuietly(['image' => $new]);
            if ($new !== $old) {
                @unlink($abs);
            }
            $saved += max(0, $before - $after);
            $count++;
            $this->info("#{$ad->id}  {$old}  ->  {$new}   ".$this->human($before).' -> '.$this->human($after));
        }

        if ($dry) {
            $this->comment("Toplam {$ads->count()} banner (dry-run).");
        } else {
            $this->comment("{$count} banner optimize edildi, ".$this->human($saved).' kazanildi.');
        }

        return self::SUCCESS;
    }

    private function human(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 2).' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1).' KB';
        }

        return $bytes.' B';
    }
}
