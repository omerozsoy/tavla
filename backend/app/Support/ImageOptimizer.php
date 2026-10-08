<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

/**
 * YÜKLEME-ANI GÖRSEL OPTİMİZASYONU (GD ile, ek bağımlılık YOK).
 *
 * Neden: ana sayfa slider'ına 2.2 MB gibi ağır banner'lar yükleniyordu -> sayfa yavaş.
 * Bu servis Filament FileUpload'un saveUploadedFileUsing kancasında çağrılır: yüklenen görseli
 * en fazla maxW genişliğe küçültür + WebP'ye (kalite ~82) sıkıştırır -> tipik 2 MB -> ~100-200 KB.
 * Şeffaflık (PNG/WebP) korunur. Başarısız olursa (GD yok / desteklenmeyen tür / hata) ORİJİNALİ
 * olduğu gibi saklar -> yükleme ASLA kırılmaz. Filament'in beklediği "disk'e göre relatif yol" döner.
 */
class ImageOptimizer
{
    /**
     * Yüklenen görseli optimize edip $disk/$dir altına yazar; kaydedilen relatif yolu döner.
     * (Filament FileUpload->saveUploadedFileUsing bu string'i model kolonuna yazar.)
     */
    public function store(
        TemporaryUploadedFile $file,
        string $disk,
        string $dir,
        int $maxW = 1920,
        int $quality = 82,
    ): string {
        try {
            $optimized = $this->optimizeToWebp($file->getRealPath(), $maxW, $quality);
            if ($optimized !== null) {
                $name = trim($dir, '/').'/'.Str::uuid()->toString().'.webp';
                Storage::disk($disk)->put($name, $optimized, 'public');

                return $name;
            }
        } catch (\Throwable $e) {
            Log::warning('ImageOptimizer başarısız, orijinal saklanıyor', ['err' => $e->getMessage()]);
        }

        // FALLBACK: optimize edilemedi -> orijinali sakla (yükleme kırılmasın). Benzersiz ad + orijinal uzantı.
        $ext = $file->getClientOriginalExtension() ?: 'img';
        $name = trim($dir, '/').'/'.Str::uuid()->toString().'.'.strtolower($ext);
        Storage::disk($disk)->putFileAs(trim($dir, '/'), $file, basename($name), 'public');

        return $name;
    }

    /**
     * SPONSOR LOGOLARI vb. için: yüklenen görseli SABİT KARE tuvale (size×size, şeffaf) ortalayıp
     * içine $innerPct oranında (contain, gerekirse BÜYÜTEREK normalize) yerleştirir -> tüm logolar
     * AYNI boyutta görünür (geniş yazı-logo da kare amblem de eşit genişlikte). WebP (alfa) döner.
     * Başarısızsa normal optimize/store'a düşer (yükleme kırılmaz).
     */
    public function storePadded(
        TemporaryUploadedFile $file,
        string $disk,
        string $dir,
        int $size = 400,
        float $innerPct = 0.9,
        int $quality = 90,
    ): string {
        try {
            $padded = $this->padToSquareWebp($file->getRealPath(), $size, $innerPct, $quality);
            if ($padded !== null) {
                $name = trim($dir, '/').'/'.Str::uuid()->toString().'.webp';
                Storage::disk($disk)->put($name, $padded, 'public');

                return $name;
            }
        } catch (\Throwable $e) {
            Log::warning('ImageOptimizer pad başarısız, normal optimize deneniyor', ['err' => $e->getMessage()]);
        }

        return $this->store($file, $disk, $dir, 1920, $quality);
    }

    /** Kaynağı $size×$size şeffaf tuvale ortalayıp contain ile yerleştirir; WebP byte döner. */
    private function padToSquareWebp(string $path, int $size, float $innerPct, int $quality): ?string
    {
        if (! function_exists('imagewebp')) {
            return null;
        }
        $loaded = $this->loadGd($path);
        if ($loaded === null) {
            return null;
        }
        [$img, $w, $h] = $loaded;

        $inner = max(1, (int) floor($size * $innerPct));
        $scale = min($inner / $w, $inner / $h); // contain; küçük logolar büyütülerek normalize edilir
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));

        $canvas = imagecreatetruecolor($size, $size);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefilledrectangle($canvas, 0, 0, $size, $size, $transparent);
        imagealphablending($canvas, true); // logoyu şeffaf zemine harmanla
        imagecopyresampled($canvas, $img, (int) round(($size - $nw) / 2), (int) round(($size - $nh) / 2), 0, 0, $nw, $nh, $w, $h);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);

        ob_start();
        $ok = imagewebp($canvas, null, max(1, min(100, $quality)));
        $bytes = ob_get_clean();
        imagedestroy($img);
        imagedestroy($canvas);

        return ($ok && $bytes !== '' && $bytes !== false) ? $bytes : null;
    }

    /** Dosyayı GD kaynağına çevirir: [\GdImage, genişlik, yükseklik] ya da null. */
    private function loadGd(string $path): ?array
    {
        if (! function_exists('getimagesize')) {
            return null;
        }
        $info = @getimagesize($path);
        if ($info === false) {
            return null;
        }
        [$w, $h] = $info;
        $type = $info[2] ?? null;
        $img = match ($type) {
            IMAGETYPE_JPEG => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($path) : false,
            IMAGETYPE_PNG => function_exists('imagecreatefrompng') ? @imagecreatefrompng($path) : false,
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            IMAGETYPE_GIF => function_exists('imagecreatefromgif') ? @imagecreatefromgif($path) : false,
            default => false,
        };

        return $img ? [$img, $w, $h] : null;
    }

    /**
     * Kaynak dosyayı GD ile oku, gerekiyorsa maxW'ye küçült, WebP olarak kodla; byte döner.
     * Desteklenmeyen tür / GD yoksa / WebP kodlanamıyorsa null (çağıran orijinale düşer).
     */
    private function optimizeToWebp(string $path, int $maxW, int $quality): ?string
    {
        if (! function_exists('imagewebp')) {
            return null;
        }
        $loaded = $this->loadGd($path);
        if ($loaded === null) {
            return null;
        }
        [$src, $w, $h] = $loaded;

        // Hedef boyut: yalnız KÜÇÜLT (upscale yok). Oran korunur.
        $scale = $w > $maxW ? $maxW / $w : 1.0;
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));

        $dst = imagecreatetruecolor($nw, $nh);
        // Şeffaflığı koru (PNG/WebP alfa).
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

        ob_start();
        $ok = imagewebp($dst, null, max(1, min(100, $quality)));
        $bytes = ob_get_clean();
        imagedestroy($src);
        imagedestroy($dst);

        return ($ok && $bytes !== '' && $bytes !== false) ? $bytes : null;
    }
}
