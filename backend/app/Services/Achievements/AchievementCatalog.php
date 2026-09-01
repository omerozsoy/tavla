<?php

namespace App\Services\Achievements;

/**
 * Katalog okuyucu — config/achievements.php uzerine ince bir cephe.
 * Slug indeksleme, esik/oran erisimi ve rarity hesabini tek yerde toplar.
 */
final class AchievementCatalog
{
    /** @var array<int,array>|null */
    private static ?array $cache = null;

    /** @var array<string,array>|null */
    private static ?array $bySlug = null;

    /** Tum rozet tanimlari (config). */
    public static function all(): array
    {
        if (self::$cache === null) {
            self::$cache = (array) config('achievements.list', []);
        }
        return self::$cache;
    }

    /** slug => tanim indeksi. */
    public static function bySlug(string $slug): ?array
    {
        if (self::$bySlug === null) {
            self::$bySlug = [];
            foreach (self::all() as $a) {
                self::$bySlug[$a['slug']] = $a;
            }
        }
        return self::$bySlug[$slug] ?? null;
    }

    public static function threshold(string $key, $default = null)
    {
        return config('achievements.thresholds.'.$key, $default);
    }

    /** Rarity bantlari (isim => min oran), yuksekten dusuge sirali dondurulur. */
    public static function rarityBands(): array
    {
        $bands = (array) config('achievements.rarity_bands', []);
        arsort($bands);
        return $bands;
    }

    /**
     * Gercek unlock oranindan (0..1) rarity adi. ratio buyukse rozet yaygin.
     * Ornek: 0.024 -> 'epic' (%1-5 bandi).
     */
    public static function rarityForRatio(float $ratio): string
    {
        $name = 'mythic';
        foreach (self::rarityBands() as $band => $min) {
            if ($ratio >= $min) {
                return $band;
            }
            $name = $band;
        }
        return $name;
    }

    /** Test/ureticiler icin cache sifirla. */
    public static function flush(): void
    {
        self::$cache = null;
        self::$bySlug = null;
    }
}
