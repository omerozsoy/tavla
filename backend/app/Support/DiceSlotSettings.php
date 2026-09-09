<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Zar Slotu ayarları. Mevcut cache'li Setting deposunu 'ds_' önekiyle yeniden kullanır;
 * kayıt yoksa config/dice-slot.php 'defaults' değerine düşer. Yeni tablo gerekmez.
 * (Şans Çarkı'nın LuckyWheelSettings deseninin birebir kardeşi.)
 */
class DiceSlotSettings
{
    private const PREFIX = 'ds_';

    /** Bir ayarın ham değeri (Setting -> config fallback). */
    private static function raw(string $key)
    {
        $all = Setting::map();
        $full = self::PREFIX.$key;
        if (array_key_exists($full, $all) && $all[$full] !== null && $all[$full] !== '') {
            return $all[$full];
        }

        return config('dice-slot.defaults.'.$key);
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
        foreach (array_keys(config('dice-slot.defaults', [])) as $key) {
            $out[$key] = self::raw($key);
        }
        // tip düzeltmeleri
        $out['enabled'] = self::bool('enabled');
        $out['require_login'] = self::bool('require_login');
        foreach ([
            'free_spins_per_day', 'spin_cost', 'cooldown_minutes', 'reset_hour',
            'die_weight', 'cube_weight',
            'payout_1', 'payout_2', 'payout_3', 'payout_4', 'payout_5', 'payout_6',
            'jackpot_base', 'jackpot_increment',
        ] as $k) {
            $out[$k] = (int) $out[$k];
        }

        return $out;
    }
}
