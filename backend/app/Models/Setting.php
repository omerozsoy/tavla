<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Site ayarı (key-value). Admin panelden düzenlenir; kod Setting::int('key', default) ile okur.
 * Tümü cache'lenir (her settle/register'da sorgu olmasın); kayıtta cache temizlenir. Tablo yoksa
 * (migration öncesi) varsayılana düşer -> deploy güvenli. Ekonomi ANAHTARLARI aşağıda.
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    /** Ekonomi ayarı anahtarları + varsayılanları (admin panel + kod tek kaynak). */
    public const DEFAULTS = [
        'starting_rating' => 1400,
        'welcome_coins' => 100,
        'reward_normal' => 25,
        'reward_premium' => 50,
        'commission_pct' => 5,
    ];

    /** Tüm ayarları cache'li key=>value dizi döndür (tablo yoksa boş). */
    public static function map(): array
    {
        return Cache::rememberForever('settings:all', function () {
            try {
                return static::query()->pluck('value', 'key')->all();
            } catch (\Throwable $e) {
                return []; // tablo yok (migration öncesi) -> varsayılanlar kullanılır
            }
        });
    }

    /** Tamsayı ayar (kayıt yoksa/boşsa default). */
    public static function int(string $key, ?int $default = null): int
    {
        $all = static::map();
        $v = $all[$key] ?? null;
        if ($v === null || $v === '') {
            return $default ?? (int) (self::DEFAULTS[$key] ?? 0);
        }

        return (int) $v;
    }

    /** Ayar yaz + cache temizle. */
    public static function put(string $key, $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => (string) $value]);
        Cache::forget('settings:all');
    }
}
