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

    /**
     * MEVCUT saklı logoyu (disk/relPath) tekrar pad'ler -> yeni kare WebP yazar, YENİ relatif yolu
     * döner (çağıran model->logo'yu günceller). Başarısızsa null (dokunma). Komut (sponsors:pad)
     * tüm eski logoları normalize etmek için kullanır.
     */
    public function padStored(string $disk, string $relPath, int $size = 400, float $innerPct = 0.9, int $quality = 90): ?string
    {
        try {
            if (! Storage::disk($disk)->exists($relPath)) {
                return null;
            }
            $tmp = tempnam(sys_get_temp_dir(), 'pad');
            file_put_contents($tmp, Storage::disk($disk)->get($relPath));
            $bytes = $this->padToSquareWebp($tmp, $size, $innerPct, $quality);
            @unlink($tmp);
            if ($bytes === null) {
                return null;
            }
            $dir = trim(str_replace('\\', '/', dirname($relPath)), '/');
            $name = ($dir !== '' && $dir !== '.' ? $dir.'/' : '').Str::uuid()->toString().'.webp';
            Storage::disk($disk)->put($name, $bytes, 'public');

            return $name;
        } catch (\Throwable $e) {
            Log::warning('ImageOptimizer padStored başarısız', ['path' => $relPath, 'err' => $e->getMessage()]);

            return null;
        }
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

        // Logo etrafındaki "boş" kenarı (şeffaf ya da köşe-arka-plan rengi) KIRP -> küçücük bir
        // amblem büyük tuvale yüklenmişse (Dimes gibi) gerçek içerik tespit edilip tam ölçeklenir.
        [$sx, $sy, $sw, $sh] = $this->contentBounds($img, $w, $h) ?? [0, 0, $w, $h];

        $inner = max(1, (int) floor($size * $innerPct));
        $scale = min($inner / $sw, $inner / $sh); // contain; küçük logolar büyütülerek normalize edilir
        $nw = max(1, (int) round($sw * $scale));
        $nh = max(1, (int) round($sh * $scale));

        $canvas = imagecreatetruecolor($size, $size);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefilledrectangle($canvas, 0, 0, $size, $size, $transparent);
        imagealphablending($canvas, true); // logoyu şeffaf zemine harmanla
        imagecopyresampled($canvas, $img, (int) round(($size - $nw) / 2), (int) round(($size - $nh) / 2), $sx, $sy, $nw, $nh, $sw, $sh);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);

        ob_start();
        $ok = imagewebp($canvas, null, max(1, min(100, $quality)));
        $bytes = ob_get_clean();
        imagedestroy($img);
        imagedestroy($canvas);

        return ($ok && $bytes !== '' && $bytes !== false) ? $bytes : null;
    }

    /**
     * Logo içeriğinin sınır kutusu [x, y, genişlik, yükseklik]: şeffaf VEYA köşe-arka-plan rengine
     * eşit pikseller "boş" sayılır, gerisi içerik. İçerik yoksa null (kırpma yapma). Logolar küçük
     * olduğu için tam tarama ucuz.
     */
    private function contentBounds(\GdImage $img, int $w, int $h): ?array
    {
        $bg = imagecolorat($img, 0, 0);
        $bgA = ($bg >> 24) & 0x7F;
        $bgR = ($bg >> 16) & 0xFF;
        $bgG = ($bg >> 8) & 0xFF;
        $bgB = $bg & 0xFF;
        $bgTransparent = $bgA >= 115;
        $tol = 20; // köşe rengine bu toleransta yakın = arka plan

        $x0 = $w;
        $y0 = $h;
        $x1 = -1;
        $y1 = -1;
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $c = imagecolorat($img, $x, $y);
                if ((($c >> 24) & 0x7F) >= 115) {
                    continue; // şeffaf -> boş
                }
                if (! $bgTransparent) {
                    $r = ($c >> 16) & 0xFF;
                    $g = ($c >> 8) & 0xFF;
                    $b = $c & 0xFF;
                    if (abs($r - $bgR) <= $tol && abs($g - $bgG) <= $tol && abs($b - $bgB) <= $tol) {
                        continue; // köşe arka plan rengi -> boş
                    }
                }
                if ($x < $x0) {
                    $x0 = $x;
                }
                if ($y < $y0) {
                    $y0 = $y;
                }
                if ($x > $x1) {
                    $x1 = $x;
                }
                if ($y > $y1) {
                    $y1 = $y;
                }
            }
        }
        if ($x1 < 0) {
            return null; // içerik bulunamadı
        }

        return [$x0, $y0, $x1 - $x0 + 1, $y1 - $y0 + 1];
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
