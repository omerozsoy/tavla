<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Ana sayfa hero banner gorseli -> bir turnuvaya baglanir (tiklaninca detaya gider).
// Sol panel rengi elle secilir; gorselden cikarilan baskin renk paleti hizli secim icin saklanir.
class TournamentAd extends Model
{
    protected $fillable = [
        'tournament_id', 'organizer_id', 'image', 'logo', 'kicker', 'title', 'subtitle', 'meta', 'cta',
        'panel_color', 'palette', 'sort', 'published',
    ];

    protected $casts = [
        'published' => 'boolean',
        'palette' => 'array',
    ];

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    // Duzenleyen kurum (Content type='kurum'). Secilirse paneldeki logo bundan cikar.
    public function organizer(): BelongsTo
    {
        return $this->belongsTo(Content::class, 'organizer_id');
    }

    // Sol panelde gosterilecek logo: once secili kurumun logosu, yoksa elle yuklenen logo.
    public function getResolvedLogoAttribute(): ?string
    {
        return $this->organizer?->image ?: $this->logo;
    }

    // panel_color yalnizca hex renk tutar (varchar 9). Gecersiz/uzun metin ( or. yanlis
    // alana yazilan reklam yazisi) DB'ye gidip "Data too long" 500 vermesin diye null'lanir.
    public function setPanelColorAttribute($value): void
    {
        $v = is_string($value) ? trim($value) : $value;
        $this->attributes['panel_color'] =
            (is_string($v) && preg_match('/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $v))
                ? $v
                : null;
    }

    protected static function booted(): void
    {
        // Gorsel degistiginde: once optimize et (kucult + WebP'ye sikistir), sonra
        // baskin renkleri cikar. Ikisi de sessiz (updateQuietly) -> event dongusu yok.
        static::saved(function (TournamentAd $ad): void {
            if (! $ad->image) {
                return;
            }
            if (! $ad->wasChanged('image') && ! empty($ad->palette)) {
                return;
            }

            // Yeni yuklenen gorsel mi? Ise once dosyayi optimize et. Uzanti degisirse
            // ( or. .jpg -> .webp) DB'deki yolu sessizce guncelle ve eski dosyayi sil.
            if ($ad->wasChanged('image')) {
                $optimized = self::optimizeImage($ad->image);
                if ($optimized !== null && $optimized !== $ad->image) {
                    $old = $ad->image;
                    $ad->image = $optimized;
                    $ad->updateQuietly(['image' => $optimized]);
                    @unlink(public_path('uploads/'.ltrim($old, '/')));
                }
            }

            $abs = public_path('uploads/'.ltrim($ad->image, '/'));
            $colors = self::extractPalette($abs);
            if (! empty($colors)) {
                $ad->updateQuietly(['palette' => $colors]);
            }
        });
    }

    /**
     * Yuklenen banner gorselini optimize eder: en fazla MAX_W genise kucultur ve
     * (destekleniyorsa) WebP'ye sikistirir. Banner ana sayfada en fazla ~1200px
     * gosterildigi icin retina payiyla 1920px ustu boyut boşuna yer kaplar.
     *
     * Yeni (goreli) dosya yolunu dondurur; degistiremezse orijinal yolu, GD/format
     * desteklenmiyorsa null doner. GIF (animasyon) ve SVG dokunulmaz.
     */
    public static function optimizeImage(string $rel): ?string
    {
        $abs = public_path('uploads/'.ltrim($rel, '/'));
        if (! is_file($abs) || ! function_exists('imagecreatefromstring')) {
            return null;
        }

        $info = @getimagesize($abs);
        if ($info === false) {
            return null; // gorsel degil / okunamaz
        }
        // Yalnizca JPEG/PNG/WEBP islenir; GIF (animasyon bozulmasin) ve digerleri atlanir.
        $type = $info[2];
        if (! in_array($type, [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            return null;
        }

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
        $maxW = 1920; // retina payiyla hero genisligi
        $quality = 82;

        // Kaynak hedeften kucuk VE dosya zaten kucuk (<300KB) ise yeniden kodlamaya deger yok.
        $alreadySmall = $w <= $maxW && strlen($data) < 300 * 1024;

        if ($w > $maxW) {
            $nh = max(1, (int) round($h * $maxW / $w));
            $dst = imagecreatetruecolor($maxW, $nh);
            // PNG/WebP saydamligini koru.
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
            imagefilledrectangle($dst, 0, 0, $maxW, $nh, $transparent);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $maxW, $nh, $w, $h);
            imagedestroy($src);
            $src = $dst;
        } elseif ($alreadySmall) {
            imagedestroy($src);
            return $rel; // dokunma
        }

        // WebP destekleniyorsa ona cevir (en iyi sikistirma), degilse ayni formatta yeniden kodla.
        $dir = trim(dirname($rel), '/.');
        $base = pathinfo($rel, PATHINFO_FILENAME);
        $useWebp = function_exists('imagewebp');
        $newRel = ($dir !== '' ? $dir.'/' : '').$base.'.'.($useWebp ? 'webp' : pathinfo($rel, PATHINFO_EXTENSION));
        $newAbs = public_path('uploads/'.$newRel);

        $ok = false;
        if ($useWebp) {
            $ok = @imagewebp($src, $newAbs, $quality);
        } elseif ($type === IMAGETYPE_PNG) {
            imagesavealpha($src, true);
            $ok = @imagepng($src, $newAbs, 8); // 0-9 sikistirma
        } else {
            $ok = @imagejpeg($src, $newAbs, $quality);
        }
        imagedestroy($src);

        if (! $ok) {
            return $rel;
        }

        // Yeni dosya orijinalden buyuk cikarsa (kucuk/optimize gorsel) yenisini sil, orijinali koru.
        if ($newRel !== $rel && is_file($newAbs) && filesize($newAbs) >= strlen($data)) {
            @unlink($newAbs);

            return $rel;
        }

        return $newRel;
    }

    /**
     * Bir gorselin baskin renklerini (en fazla $count) #rrggbb dizisi olarak dondurur.
     * GD yoksa / dosya okunamazsa bos dizi doner (sessiz).
     */
    public static function extractPalette(string $absPath, int $count = 5): array
    {
        if (! is_file($absPath) || ! function_exists('imagecreatefromstring')) {
            return [];
        }
        $data = @file_get_contents($absPath);
        if ($data === false) {
            return [];
        }
        $img = @imagecreatefromstring($data);
        if (! $img) {
            return [];
        }

        $w = imagesx($img);
        $h = imagesy($img);
        $sw = 80;
        $sh = max(1, (int) round($h * $sw / max(1, $w)));
        $small = imagecreatetruecolor($sw, $sh);
        imagecopyresampled($small, $img, 0, 0, 0, 0, $sw, $sh, $w, $h);
        imagedestroy($img);

        $buckets = [];
        for ($y = 0; $y < $sh; $y++) {
            for ($x = 0; $x < $sw; $x++) {
                $rgb = imagecolorat($small, $x, $y);
                $r = ($rgb >> 16) & 255;
                $g = ($rgb >> 8) & 255;
                $b = $rgb & 255;
                // 12-bit'e nicele (benzer tonlari grupla)
                $key = (($r >> 4) << 8) | (($g >> 4) << 4) | ($b >> 4);
                if (! isset($buckets[$key])) {
                    $buckets[$key] = ['n' => 0, 'r' => 0, 'g' => 0, 'b' => 0];
                }
                $buckets[$key]['n']++;
                $buckets[$key]['r'] += $r;
                $buckets[$key]['g'] += $g;
                $buckets[$key]['b'] += $b;
            }
        }
        imagedestroy($small);

        uasort($buckets, fn ($a, $b) => $b['n'] <=> $a['n']);

        $out = [];
        foreach ($buckets as $bk) {
            $r = (int) round($bk['r'] / $bk['n']);
            $g = (int) round($bk['g'] / $bk['n']);
            $b = (int) round($bk['b'] / $bk['n']);
            $out[] = sprintf('#%02x%02x%02x', $r, $g, $b);
            if (count($out) >= $count) {
                break;
            }
        }

        return $out;
    }
}
