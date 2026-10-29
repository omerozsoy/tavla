<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Avatar deposu: base64 (data:) avatarı 128×128 WebP DOSYAYA yazıp KISA public URL döndürür.
 *
 * NEDEN: avatar eskiden users.avatar'da base64 data-URI olarak saklanıyordu (ort ~12KB, max 68KB)
 * ve odaya (rooms.p1/p2_avatar) kopyalanıp HER poll yanıtında (600ms-2.5sn) tekrar iniyordu →
 * maç başına MB'larca gereksiz trafik. Kısa URL ile poll gövdesi ~40 karakter; tarayıcı resmi
 * hash-isimli (içerik-adresli = immutable) URL'den BİR KEZ indirir, poll'lerde tekrar inmez.
 *
 * İDEMPOTENT: data: olmayan değer (URL / preset id / boş) OLDUĞU GİBİ döner — ucuz string kontrolü,
 * dosya IO yok. Böylece tüm yazım noktalarına (profil/register/oda) güvenle sarılabilir; iki kez
 * çağrılsa da zarar vermez (migration + canlı yazım aynı yoldan geçer).
 */
class AvatarStore
{
    /** WebP kenar uzunluğu (kare). Avatarlar küçük gösterilir; 128 fazlasıyla yeter. */
    private const SIZE = 128;

    /** WebP kalite (0-100). 82 = görünür kayıpsız, ~2-4KB dosya. */
    private const QUALITY = 82;

    /**
     * Avatarı normalize et. data: URI → WebP dosya + '/uploads/avatars/{sha1}.webp' URL.
     * data: değilse (URL/preset/boş) olduğu gibi döner. Hata → orijinali döner (avatar kaybolmasın).
     */
    public static function store(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        // Zaten URL / preset / emoji ref → dokunma (idempotent, dosya IO yok).
        if (! str_starts_with($value, 'data:image')) {
            return $value;
        }

        try {
            $comma = strpos($value, ',');
            if ($comma === false) {
                return $value;
            }
            $bin = base64_decode(substr($value, $comma + 1), true);
            if ($bin === false || $bin === '') {
                return $value;
            }
            $src = @imagecreatefromstring($bin);
            if (! $src) {
                return $value; // bozuk/desteklenmeyen görsel → base64 kalsın (kayıp yok)
            }
            $webp = self::toSquareWebp($src);
            imagedestroy($src);
            if ($webp === null) {
                return $value;
            }

            $hash = sha1($webp); // içerik-adresli → immutable, aynı görsel = aynı dosya (dedup)
            $dir = public_path('uploads/avatars');
            if (! is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            $file = $dir.DIRECTORY_SEPARATOR.$hash.'.webp';
            if (! is_file($file)) {
                file_put_contents($file, $webp);
            }

            return '/uploads/avatars/'.$hash.'.webp';
        } catch (\Throwable $e) {
            Log::warning('AvatarStore::store failed', ['err' => $e->getMessage()]);

            return $value; // başarısızlıkta orijinali koru
        }
    }

    /** Merkezden kare kırp + SIZE×SIZE'a küçült + WebP binary döndür (şeffaflık korunur). */
    private static function toSquareWebp(\GdImage $src, int $size = self::SIZE): ?string
    {
        $w = imagesx($src);
        $h = imagesy($src);
        if ($w < 1 || $h < 1) {
            return null;
        }
        $side = min($w, $h);
        $sx = (int) (($w - $side) / 2);
        $sy = (int) (($h - $side) / 2);

        $dst = imagecreatetruecolor($size, $size);
        imagealphablending($dst, false); // PNG/WebP alfa kanalını koru (düz siyah zemin olmasın)
        imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, $sx, $sy, $size, $size, $side, $side);

        ob_start();
        $ok = imagewebp($dst, null, self::QUALITY);
        $out = ob_get_clean();
        imagedestroy($dst);

        return ($ok && $out !== '' && $out !== false) ? $out : null;
    }
}
