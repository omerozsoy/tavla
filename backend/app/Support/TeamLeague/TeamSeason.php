<?php

namespace App\Support\TeamLeague;

use Illuminate\Support\Carbon;

/**
 * Takımlar Ligi SEZONU — 3 aylık dönemler (takvim çeyreği + Türkçe mevsim adı). Kış = yılın İLK
 * çeyreği (1 Ocak 00:00 başlar). Sezon anahtarı "YYYY-slug" (ör. "2027-kis"). Saat dilimi app
 * config'inden (Europe/Istanbul, GMT+3) gelir — sınırlar duvar saatidir (1 Ocak 2027 00:00 TR).
 *
 *   Kış      : Oca-Şub-Mar   (01-03)
 *   İlkbahar : Nis-May-Haz   (04-06)
 *   Yaz      : Tem-Ağu-Eyl   (07-09)
 *   Sonbahar : Eki-Kas-Ara   (10-12)
 *
 * Puan/sıralama month_key maçlarından ANLIK hesaplanır (TeamStandings::seasonTable); sezon değişince
 * yeni maçlar farklı month_key'lere düştüğü için puan OTOMATİK 0'dan başlar (ekstra sıfırlama yok).
 */
class TeamSeason
{
    /** slug => görünen mevsim adı. */
    public const NAMES = [
        'kis' => 'Kış',
        'ilkbahar' => 'İlkbahar',
        'yaz' => 'Yaz',
        'sonbahar' => 'Sonbahar',
    ];

    /** Mevsimin başladığı ay (1-tabanlı). */
    private const START_MONTH = ['kis' => 1, 'ilkbahar' => 4, 'yaz' => 7, 'sonbahar' => 10];

    /** Ay (1-12) -> mevsim slug. */
    public static function slugOfMonth(int $month): string
    {
        if ($month <= 3) {
            return 'kis';
        }
        if ($month <= 6) {
            return 'ilkbahar';
        }
        if ($month <= 9) {
            return 'yaz';
        }

        return 'sonbahar';
    }

    /** Tarih -> sezon anahtarı "YYYY-slug". */
    public static function keyOf(Carbon $d): string
    {
        return $d->year.'-'.self::slugOfMonth($d->month);
    }

    /** Şu anki (veya verilen an) sezon anahtarı. */
    public static function currentKey(?Carbon $now = null): string
    {
        return self::keyOf($now ? $now->copy() : now());
    }

    /** "YYYY-slug" -> o sezonun 3 ay anahtarı ["YYYY-MM", ...]. */
    public static function monthKeys(string $seasonKey): array
    {
        [$year, $slug] = self::parse($seasonKey);
        $start = self::START_MONTH[$slug] ?? 1;
        $keys = [];
        for ($i = 0; $i < 3; $i++) {
            $keys[] = sprintf('%04d-%02d', $year, $start + $i);
        }

        return $keys;
    }

    /** Görünen ad: "Kış 2027". */
    public static function name(string $seasonKey): string
    {
        [$year, $slug] = self::parse($seasonKey);

        return (self::NAMES[$slug] ?? ucfirst($slug)).' '.$year;
    }

    /** Sezon başlangıcı (ilk ayın 1'i 00:00, app tz). */
    public static function start(string $seasonKey): Carbon
    {
        [$year, $slug] = self::parse($seasonKey);

        return Carbon::create($year, self::START_MONTH[$slug] ?? 1, 1, 0, 0, 0);
    }

    /** Sezon bitişi (son ayın son saniyesi, ör. 31 Mart 23:59:59). */
    public static function end(string $seasonKey): Carbon
    {
        return self::start($seasonKey)->addMonthsNoOverflow(3)->subSecond();
    }

    /** Verilen ana göre BİTMİŞ (bir önceki) sezonun anahtarı — maintenance ödül dağıtımı için. */
    public static function prevKey(?Carbon $now = null): string
    {
        $base = ($now ? $now->copy() : now())->subMonthsNoOverflow(3);

        return self::keyOf($base);
    }

    /** "YYYY-slug" -> [int yıl, string slug]. Geçersizse bugünün sezonu. */
    private static function parse(string $seasonKey): array
    {
        if (preg_match('/^(\d{4})-(kis|ilkbahar|yaz|sonbahar)$/', $seasonKey, $m)) {
            return [(int) $m[1], $m[2]];
        }
        $now = now();

        return [$now->year, self::slugOfMonth($now->month)];
    }
}
