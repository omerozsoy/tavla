<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Tavla tahtası tasarımı (admin "Tavla Tasarımı" sayfası).
 *  - Yerleşik (is_custom=false): renk/ad KODA aittir (src/boardThemes.ts -> board_themes.json);
 *    admin yalnız grup / fiyat / satış durumunu değiştirir.
 *  - Özel (is_custom=true): admin'in renklerini seçip satışa koyduğu tahta.
 */
class BoardDesign extends Model
{
    public const GROUPS = [
        'common' => 'Standart',
        'rare' => 'Nadir',
        'epic' => 'Epik',
        'legendary' => 'Efsanevi',
        'mythic' => 'Mitik',
        'club' => 'Kulüp',
        'country' => 'Ülke',
        'tavlatv' => 'TavlaTV Özel',
    ];

    public const SURFACES = ['plain' => 'Düz', 'gradient' => 'Degrade', 'felt' => 'Keçe', 'wood' => 'Ahşap'];

    public const CHECKER_STYLES = ['flat' => 'Düz', 'gloss' => 'Parlak', 'ice' => 'Buz', 'ring' => 'Halka', 'neon' => 'Neon'];

    /** Her zaman ücretsiz/sahip olunan tahta (frontend FREE_BOARDS). */
    public const FREE = ['standart'];

    private const CACHE_KEY = 'board_designs.all.v1';

    protected $fillable = ['slug', 'name', 'group', 'price', 'is_custom', 'colors', 'surface', 'surface_image_left', 'surface_image_right', 'surface_image_opacity', 'checker_style', 'point_mode', 'point_image_odd', 'point_image_even', 'point_image_fit', 'point_images', 'point_texts', 'active', 'sort'];

    protected $casts = [
        'colors' => 'array',
        'point_image_fit' => 'array',
        'point_images' => 'array',
        'point_texts' => 'array',
        'is_custom' => 'boolean',
        'active' => 'boolean',
        'price' => 'integer',
        'sort' => 'integer',
        'surface_image_opacity' => 'integer',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $d) {
            if ($d->is_custom && blank($d->slug)) {
                do {
                    $slug = 'ozel-'.Str::lower(Str::random(8));
                } while (self::where('slug', $slug)->exists());
                $d->slug = $slug;
            }
        });
        // Zemin resmi şeffaflığı (%0–100) + her haneye metin (1..24, boşlar atılır, kırpılır).
        // Resim yerleşiminden BAĞIMSIZ (aşağıdaki erken return'den önce çalışmalı).
        static::saving(function (self $d) {
            $d->surface_image_opacity = max(0, min(100, (int) ($d->surface_image_opacity ?? 100)));
            $texts = [];
            foreach ((array) ($d->point_texts ?? []) as $n => $txt) {
                $n = (int) $n;
                $txt = is_string($txt) ? trim($txt) : '';
                if ($n >= 1 && $n <= 24 && $txt !== '') {
                    $texts[$n] = mb_substr($txt, 0, 24);
                }
            }
            ksort($texts);
            $d->point_texts = $texts ?: null;
        });
        // Hane resmi yerleşimi: değerleri sınırla + resmin en-boy oranını dosyadan hesapla.
        static::saving(function (self $d) {
            // Resimsiz tahta (yerleşikler dahil): dokunma — ilk migration'daki senkron bu kolon
            // eklenmeden önce çalışır; ayrıca gereksiz veri yazılmaz.
            if (! $d->point_image_odd && ! $d->point_image_even && $d->point_image_fit === null && empty($d->point_images)) {
                return;
            }
            $fit = is_array($d->point_image_fit) ? $d->point_image_fit : [];
            // Her haneye ayrı resim: yalnız 1..24 anahtarları, boşlar atılır
            $each = [];
            foreach ((array) ($d->point_images ?? []) as $n => $path) {
                $n = (int) $n;
                if ($n >= 1 && $n <= 24 && is_string($path) && $path !== '') {
                    $each[$n] = $path;
                }
            }
            ksort($each);
            $d->point_images = $each ?: null;
            $targets = ['odd' => $d->point_image_odd, 'even' => $d->point_image_even];
            foreach ($each as $n => $path) {
                $targets['p'.$n] = $path;
            }
            foreach ($targets as $k => $path) {
                $f = is_array($fit[$k] ?? null) ? $fit[$k] : [];
                $f = self::clampFit($f);
                if ($path) {
                    $abs = \Illuminate\Support\Facades\Storage::disk('uploads')->path($path);
                    $size = @getimagesize($abs);
                    if ($size && $size[1] > 0) {
                        $f['aspect'] = round($size[0] / $size[1], 4);
                    }
                }
                $fit[$k] = $f;
            }
            // Silinmiş hanelerin yerleşimini at
            foreach (array_keys($fit) as $k) {
                if (str_starts_with((string) $k, 'p') && ! isset($targets[$k])) {
                    unset($fit[$k]);
                }
            }
            $d->point_image_fit = $fit;
        });
        static::saved(fn () => Cache::forget(self::CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::CACHE_KEY));
    }

    /** Yerleşim değerlerini güvenli aralığa çek (x/y 0–100 %, zoom 100–400 %, aspect 0.05–20). */
    public static function clampFit(array $f): array
    {
        $num = fn ($v, $d) => is_numeric($v) ? (float) $v : $d;
        $out = [
            'x' => max(0, min(100, $num($f['x'] ?? null, 50))),
            'y' => max(0, min(100, $num($f['y'] ?? null, 50))),
            'zoom' => max(100, min(400, $num($f['zoom'] ?? null, 100))),
        ];
        if (isset($f['aspect']) && is_numeric($f['aspect'])) {
            $out['aspect'] = max(0.05, min(20, (float) $f['aspect']));
        }

        return $out;
    }

    /** Hane resminin herkese açık URL'si (uploads diski; yoksa null). */
    public static function imageUrl(?string $path): ?string
    {
        return $path ? \Illuminate\Support\Facades\Storage::disk('uploads')->url($path) : null;
    }

    public function isFree(): bool
    {
        return in_array($this->slug, self::FREE, true);
    }

    /** Tüm satırlar (kısa cache; kayıt/silmede temizlenir). */
    public static function allCached()
    {
        return Cache::remember(self::CACHE_KEY, 300, fn () => self::query()->orderBy('sort')->orderBy('id')->get());
    }

    /**
     * Yerleşik tahtaları JSON'dan senkronla (idempotent). Yeni tahta -> satır eklenir (varsayılan
     * grup, satışta); mevcutta yalnız koda ait alanlar (ad/renk/sıra) güncellenir — admin'in
     * grup/fiyat/satış ayarı korunur.
     */
    public static function syncBuiltins(): void
    {
        $path = database_path('data/board_themes.json');
        if (! is_file($path)) {
            return;
        }
        $rows = json_decode((string) file_get_contents($path), true) ?: [];
        $existing = self::where('is_custom', false)->get()->keyBy('slug');
        foreach ($rows as $r) {
            $attrs = ['name' => $r['name'], 'colors' => $r['colors'], 'sort' => (int) $r['sort'],
                'surface' => $r['surface'] ?? null, 'checker_style' => $r['checker_style'] ?? null];
            $d = $existing->get($r['id']);
            if ($d) {
                $d->fill($attrs);
                if ($d->isDirty()) {
                    $d->save();
                }
            } else {
                self::create($attrs + ['slug' => $r['id'], 'group' => $r['group'], 'is_custom' => false, 'active' => true]);
            }
        }
    }
}
