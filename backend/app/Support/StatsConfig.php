<?php

namespace App\Support;

/**
 * Oyuncu istatistik sistemi — MERKEZI domain kurallari (tek kaynak).
 * WXP kurallari, median kategorileri ve tarih filtreleri burada; magic-number/string
 * kod tabanina dagitilmaz. Yeni match_length (9S/11S...) eklemek icin yalnizca buraya ekle.
 */
final class StatsConfig
{
    public const MATCH_TYPE_COIN = 'coin';   // Jeton/tek-oyun coin bahsi
    public const MATCH_TYPE_MATCH = 'match'; // N-puanlik mac

    /** Median "Medyan Hata Orani" kategorileri: anahtar => UI label. Sirali. */
    public const CATEGORIES = [
        'coin' => 'Jeton',
        '1' => '1S',
        '3' => '3S',
        '5' => '5S',
        '7' => '7S',
    ];

    /** WXP: coin galibiyeti sabit puan. */
    public const WXP_COIN = 1;

    /** WXP veren desteklenen mac uzunluklari (urun kurali). Kazanan match_length kadar WXP alir. */
    public const WXP_SUPPORTED_LENGTHS = [1, 3, 5, 7];

    /** Tarih filtreleri: anahtar => geriye gun (null = tumu). */
    public const DATE_FILTERS = [
        'all' => null,
        '7d' => 7,
        '30d' => 30,
        '90d' => 90,
        '1y' => 365,
    ];

    /**
     * Kazanilan bir mac icin WXP miktari.
     * coin -> +1 ; desteklenen match_length -> +match_length ; aksi halde 0 (WXP yok).
     */
    public static function wxpForWin(string $matchType, ?int $matchLength): int
    {
        if ($matchType === self::MATCH_TYPE_COIN) {
            return self::WXP_COIN;
        }
        if ($matchLength !== null && in_array($matchLength, self::WXP_SUPPORTED_LENGTHS, true)) {
            return $matchLength;
        }
        return 0;
    }

    /**
     * Bir maci hangi median kategorisine koyacagimiz. null => hicbir kategoriye girmez.
     * coin -> 'coin' ; tanimli match_length -> "1"/"3"/"5"/"7".
     */
    public static function categoryKey(string $matchType, ?int $matchLength): ?string
    {
        if ($matchType === self::MATCH_TYPE_COIN) {
            return 'coin';
        }
        if ($matchLength !== null && isset(self::CATEGORIES[(string) $matchLength])) {
            return (string) $matchLength;
        }
        return null;
    }

    /** Gecerli filtre anahtari mi? (degilse cagiran 'all'e duser) */
    public static function isValidFilter(string $filter): bool
    {
        return array_key_exists($filter, self::DATE_FILTERS);
    }
}
