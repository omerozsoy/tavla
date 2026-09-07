<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Şans Çarkı ayarları. Mevcut cache'li Setting deposunu 'lw_' önekiyle yeniden kullanır;
 * kayıt yoksa config/lucky-wheel.php 'defaults' değerine düşer. Yeni tablo gerekmez.
 */
class LuckyWheelSettings
{
    private const PREFIX = 'lw_';

    /** Bir ayarın ham değeri (Setting -> config fallback). */
    private static function raw(string $key)
    {
        $all = Setting::map();
        $full = self::PREFIX.$key;
        if (array_key_exists($full, $all) && $all[$full] !== null && $all[$full] !== '') {
            return $all[$full];
        }
        return config('lucky-wheel.defaults.'.$key);
    }

    public static function bool(string $key): bool
    {
        $v = self::raw($key);
        return filter_var($v, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $v;
    }

    public static function int(string $key): int
    {
        return (int) self::raw($key);
    }

    public static function string(string $key): string
    {
        return (string) self::raw($key);
    }

    public static function put(string $key, $value): void
    {
        if (is_bool($value)) {
            $value = $value ? '1' : '0';
        }
        Setting::put(self::PREFIX.$key, $value);
    }

    /** Tüm ayarları (fallback dahil) dizi olarak döndür (admin form + API). */
    public static function all(): array
    {
        $out = [];
        foreach (array_keys(config('lucky-wheel.defaults', [])) as $key) {
            $out[$key] = self::raw($key);
        }
        // tip düzeltmeleri
        $out['enabled'] = self::bool('enabled');
        $out['require_login'] = self::bool('require_login');
        $out['show_probability'] = self::bool('show_probability');
        foreach (['free_spins_per_day', 'min_slice_count', 'max_slice_count', 'cooldown_minutes', 'animation_duration', 'reset_hour'] as $k) {
            $out[$k] = (int) $out[$k];
        }
        return $out;
    }
}
