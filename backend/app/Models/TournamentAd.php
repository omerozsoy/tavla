<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Ana sayfa hero banner gorseli -> bir turnuvaya baglanir (tiklaninca detaya gider).
// Sol panel rengi elle secilir; gorselden cikarilan baskin renk paleti hizli secim icin saklanir.
class TournamentAd extends Model
{
    protected $fillable = [
        'tournament_id', 'image', 'logo', 'kicker', 'title', 'subtitle', 'meta', 'cta',
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
        // Gorsel degistiginde (ya da palet bossa) baskin renkleri cikar ve sessizce sakla.
        static::saved(function (TournamentAd $ad): void {
            if (! $ad->image) {
                return;
            }
            if (! $ad->wasChanged('image') && ! empty($ad->palette)) {
                return;
            }
            $abs = public_path('uploads/'.ltrim($ad->image, '/'));
            $colors = self::extractPalette($abs);
            if (! empty($colors)) {
                $ad->updateQuietly(['palette' => $colors]);
            }
        });
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
