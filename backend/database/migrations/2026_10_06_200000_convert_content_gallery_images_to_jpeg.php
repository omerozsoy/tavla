<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Makale/haber GALERİ görsellerini JPEG'e çevir (kapak migration'ının eşi; galeri dizisi için).
 *
 * content.gallery (array) içindeki .png girişlerini 1280px JPEG q82'ye küçültür, referansı .jpg'e
 * günceller, eski .png'yi siler. DOSYA-FARKINDA ve GÜVENLİ: .jpg gerçekten oluşunca referansı
 * değiştirir -> kırık görsel yok. GD yoksa no-op. Tek yönlü.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagejpeg')) {
            return;
        }

        $rows = DB::table('contents')
            ->whereIn('type', ['makale', 'news'])
            ->whereNotNull('gallery')
            ->where('gallery', '!=', '[]')
            ->get(['id', 'gallery']);

        foreach ($rows as $row) {
            try {
                $gallery = json_decode((string) $row->gallery, true);
                if (! is_array($gallery) || $gallery === []) {
                    continue;
                }
                $changed = false;
                foreach ($gallery as $i => $val) {
                    if (! is_string($val) || ! preg_match('/\.png$/i', $val)) {
                        continue;
                    }
                    $rel = $this->resolve($val);
                    if ($rel === null) {
                        continue; // harici url -> dokunma
                    }
                    $jpgVal = preg_replace('/\.png$/i', '.jpg', $val);
                    $jpgRel = $this->resolve($jpgVal);
                    $jpgAbs = public_path($jpgRel);
                    if (! is_file($jpgAbs)) {
                        $srcAbs = public_path($rel);
                        if (! is_file($srcAbs) || ! $this->toJpeg($srcAbs, $jpgAbs, 1280, 82)) {
                            continue; // üretilemedi -> referansa DOKUNMA
                        }
                        @unlink($srcAbs);
                    }
                    $gallery[$i] = $jpgVal;
                    $changed = true;
                }
                if ($changed) {
                    DB::table('contents')->where('id', $row->id)->update(['gallery' => json_encode(array_values($gallery))]);
                }
            } catch (\Throwable $e) {
                continue;
            }
        }
    }

    public function down(): void
    {
        // Tek yönlü.
    }

    /** Saklanan görsel değerini public/ köküne göreli yola çevir (harici url -> null). */
    private function resolve(string $val): ?string
    {
        if (preg_match('#^https?://#i', $val)) {
            return null;
        }
        if (str_starts_with($val, 'uploads/')) {
            return $val;
        }
        if (str_starts_with($val, '/')) {
            return ltrim($val, '/'); // /uploads/... veya diğer public-altı mutlak
        }

        return 'uploads/' . $val; // çıplak (ör. makale/x.png)
    }

    private function toJpeg(string $srcAbs, string $jpgAbs, int $maxW, int $quality): bool
    {
        $data = @file_get_contents($srcAbs);
        if ($data === false) {
            return false;
        }
        $src = @imagecreatefromstring($data);
        if (! $src) {
            return false;
        }
        $w = imagesx($src);
        $h = imagesy($src);
        if ($w > $maxW) {
            $nh = max(1, (int) round($h * $maxW / $w));
            $d = imagecreatetruecolor($maxW, $nh);
            imagecopyresampled($d, $src, 0, 0, 0, 0, $maxW, $nh, $w, $h);
            imagedestroy($src);
            $src = $d;
            $w = $maxW;
            $h = $nh;
        }
        $dst = imagecreatetruecolor($w, $h);
        $white = imagecolorallocate($dst, 255, 255, 255);
        imagefilledrectangle($dst, 0, 0, $w, $h, $white);
        imagecopy($dst, $src, 0, 0, 0, 0, $w, $h);
        @mkdir(dirname($jpgAbs), 0755, true);
        $ok = imagejpeg($dst, $jpgAbs, $quality);
        imagedestroy($src);
        imagedestroy($dst);

        return (bool) $ok;
    }
};
