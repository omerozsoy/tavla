<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Avatar çerçevesi / pul tasarımı mağaza ayarı (admin "Avatar Tasarımı" / "Pul Tasarımı").
 * Görsel (animasyon, materyal) koda aittir; admin grup / fiyat / satış durumunu yönetir.
 */
class CosmeticItem extends Model
{
    public const GROUPS = [
        'common' => 'Standart',
        'rare' => 'Nadir',
        'epic' => 'Epik',
        'legendary' => 'Efsanevi',
        'mythic' => 'Mitik',
    ];

    public const KIND_PREFIX = ['frame' => 'frame.', 'checker' => 'checker.'];

    private const CACHE_KEY = 'cosmetic_items.all.v1';

    protected $fillable = ['kind', 'item_id', 'name', 'group', 'price', 'active', 'meta', 'sort'];

    protected $casts = [
        'meta' => 'array',
        'active' => 'boolean',
        'price' => 'integer',
        'sort' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::CACHE_KEY));
    }

    /** Mağaza unlock id'si ('frame.pulse', 'checker.finish-pearl'). */
    public function unlockId(): string
    {
        return self::KIND_PREFIX[$this->kind].$this->item_id;
    }

    public static function allCached()
    {
        return Cache::remember(self::CACHE_KEY, 300, fn () => self::query()->orderBy('kind')->orderBy('sort')->get());
    }

    /** JSON'daki öğeler için satır oluştur; mevcutta yalnız ad/önizleme/sıra güncellenir. */
    public static function syncCatalog(): void
    {
        $path = database_path('data/cosmetics.json');
        if (! is_file($path)) {
            return;
        }
        $rows = json_decode((string) file_get_contents($path), true) ?: [];
        $existing = self::all()->keyBy(fn (self $c) => $c->kind.':'.$c->item_id);
        foreach ($rows as $r) {
            $attrs = ['name' => $r['name'], 'meta' => $r['meta'] ?? null, 'sort' => (int) $r['sort']];
            $c = $existing->get($r['kind'].':'.$r['id']);
            if ($c) {
                $c->fill($attrs);
                if ($c->isDirty()) {
                    $c->save();
                }
            } else {
                self::create($attrs + ['kind' => $r['kind'], 'item_id' => $r['id'], 'group' => $r['group'], 'active' => true]);
            }
        }
    }
}
