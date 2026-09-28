<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * MEVCUT YÜKLENMİŞ GÖRSELLERİ RETROAKTİF OPTİMİZE ETME (GD, ek bağımlılık YOK).
 *
 * Neden: upload-anı optimizasyonu (ImageOptimizer / TournamentAd::optimizeImage) yalnız YENİ
 * yüklemelere uygulanır; eskiden yüklenmiş görseller (banner + /bilgi sayfa gövdesi + galeriler)
 * ham/ağır kalır. Bu komut public/uploads altındaki tüm JPEG/PNG/WebP'leri gezip:
 *   - genişliği maxW'yi aşanı maxW'ye küçültür (retina payı),
 *   - AYNI ad + AYNI formatta yeniden kodlar (quality),
 *   - yalnız sonuç DAHA KÜÇÜKSE üzerine yazar.
 *
 * KRİTİK: dosya adı/uzantısı DEĞİŞMEZ -> body HTML'deki <img src>, gallery dizileri ve
 * TournamentAd.image kolonları KIRILMAZ, DB'ye hiç dokunulmaz. Bu yüzden WebP'ye çevirmez
 * (uzantı değişimi tüm referansları kırardı; WebP kazanımı istenirse per-tablo referans
 * güncellemesiyle ayrı bir iş). GIF (animasyon) ve SVG atlanır. Idempotent: ikinci koşuda
 * zaten optimize dosyalar "daha küçük çıkmadı" diye atlanır.
 */
class OptimizeUploads extends Command
{
    protected $signature = 'tavla:optimize-uploads
        {--dir= : public/uploads altında yalnız bu alt dizin (örn: bilgi)}
        {--max-width=1920 : Bu genişliği aşan görseller küçültülür}
        {--quality=82 : JPEG/WebP yeniden kodlama kalitesi (1-100)}
        {--dry-run : Yazmadan ne kazanılacağını raporla}';

    protected $description = 'Mevcut yüklenmiş görselleri (banner + bilgi sayfaları) yerinde optimize eder; dosya adı/format değişmez, referanslar kırılmaz.';

    public function handle(): int
    {
        if (! function_exists('imagecreatefromstring')) {
            $this->error('GD eklentisi yok (imagecreatefromstring). Optimizasyon yapılamaz.');

            return self::FAILURE;
        }

        $root = public_path('uploads');
        $sub = trim((string) $this->option('dir'), '/');
        $scan = $sub !== '' ? $root.'/'.$sub : $root;
        if (! is_dir($scan)) {
            $this->error("Dizin yok: {$scan}");

            return self::FAILURE;
        }

        $maxW = max(1, (int) $this->option('max-width'));
        $quality = max(1, min(100, (int) $this->option('quality')));
        $dry = (bool) $this->option('dry-run');

        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($scan, \FilesystemIterator::SKIP_DOTS)
        );

        $seen = 0;
        $changed = 0;
        $before = 0;
        $after = 0;

        foreach ($files as $file) {
            if (! $file->isFile()) {
                continue;
            }
            $abs = $file->getPathname();
            $info = @getimagesize($abs);
            if ($info === false) {
                continue; // görsel değil
            }
            $type = $info[2] ?? null;
            if (! in_array($type, [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
                continue; // GIF/SVG/BMP -> dokunma
            }
            $seen++;

            $origSize = (int) filesize($abs);
            $optimized = $this->recompress($abs, $type, $maxW, $quality);
            if ($optimized === null || strlen($optimized) >= $origSize) {
                continue; // kodlanamadı ya da daha küçük değil -> atla
            }

            $before += $origSize;
            $after += strlen($optimized);
            $changed++;
            $rel = ltrim(str_replace($root, '', $abs), '/\\');
            $this->line(sprintf(
                '  %s  %s -> %s  (-%d%%)',
                $dry ? '[dry]' : '[ok] ',
                $this->human($origSize),
                $this->human(strlen($optimized)),
                (int) round((1 - strlen($optimized) / $origSize) * 100),
            ).'  '.$rel);

            if (! $dry) {
                file_put_contents($abs, $optimized);
            }
        }

        $saved = $before - $after;
        $this->info(sprintf(
            '%d görsel tarandı, %d optimize %s. Kazanç: %s -> %s (%s daha az).',
            $seen,
            $changed,
            $dry ? 'EDİLECEK (dry-run)' : 'edildi',
            $this->human($before),
            $this->human($after),
            $this->human($saved),
        ));

        return self::SUCCESS;
    }

    /** Dosyayı GD ile oku, gerekiyorsa küçült, AYNI formatta yeniden kodla; byte döner (null=başarısız). */
    private function recompress(string $abs, int $type, int $maxW, int $quality): ?string
    {
        $data = @file_get_contents($abs);
        if ($data === false) {
            return null;
        }
        $src = @imagecreatefromstring($data);
        if (! $src) {
            return null;
        }

        $w = imagesx($src);
        $h = imagesy($src);

        if ($w > $maxW) {
            $nh = max(1, (int) round($h * $maxW / $w));
            $dst = imagecreatetruecolor($maxW, $nh);
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $maxW, $nh, $w, $h);
            imagedestroy($src);
            $src = $dst;
        }

        ob_start();
        $ok = match ($type) {
            IMAGETYPE_JPEG => imagejpeg($src, null, $quality),
            IMAGETYPE_WEBP => imagewebp($src, null, $quality),
            IMAGETYPE_PNG => (imagesavealpha($src, true) && imagepng($src, null, 9)), // PNG: kayıpsız, sadece yeniden sıkıştırma
            default => false,
        };
        $bytes = ob_get_clean();
        imagedestroy($src);

        return ($ok && $bytes !== '' && $bytes !== false) ? $bytes : null;
    }

    private function human(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1).' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024).' KB';
        }

        return $bytes.' B';
    }
}
