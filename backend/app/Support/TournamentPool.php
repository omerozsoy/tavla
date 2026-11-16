<?php

namespace App\Support;

use App\Models\Commission;
use App\Models\Tournament;

/**
 * Yüzdeli ödül havuzu (turnuva kurulurken "Ödül havuzu: Evet").
 * Havuz = kayıtlı oyuncuların GERÇEKTEN ödediği giriş ücretleri (players[].fee_paid; kayıt açıkken
 * çekilen/iptal edilen zaten listeden çıkıp iade alır). Havuzun %COMMISSION_PCT'si komisyon, kalanı
 * pool_pcts (1./2./3.) yüzdeleriyle dağıtılır; yuvarlama artığı şampiyona. Pay, ödül tablosundaki
 * (prizes) aynı sıranın coin'ine EKLENİR -> tie-farkında dağıtım PrizeDistribution'dan geçer.
 */
class TournamentPool
{
    public const COMMISSION_PCT = 10;

    public const DEFAULT_PCTS = [60, 25, 15];

    public static function enabled(Tournament $t): bool
    {
        return (bool) ($t->pool_enabled ?? false);
    }

    /** Geçerli yüzdeler (3 eleman, int). Bozuk/eksikse varsayılan. */
    public static function pcts(Tournament $t): array
    {
        $raw = is_array($t->pool_pcts) ? $t->pool_pcts : [];
        // Filament formu {p1,p2,p3} yazar; liste [60,25,15] de kabul.
        $p = isset($raw['p1']) || isset($raw['p2']) || isset($raw['p3'])
            ? [$raw['p1'] ?? 0, $raw['p2'] ?? 0, $raw['p3'] ?? 0]
            : array_values($raw);
        if (count($p) !== 3) {
            return self::DEFAULT_PCTS;
        }

        return array_map(fn ($v) => max(0, (int) $v), $p);
    }

    /** Toplanan giriş ücreti (coin). */
    public static function collected(Tournament $t): int
    {
        $sum = 0;
        foreach ($t->players ?? [] as $p) {
            if (is_array($p)) {
                $sum += max(0, (int) ($p['fee_paid'] ?? 0));
            }
        }

        return $sum;
    }

    public static function commission(int $collected): int
    {
        return intdiv($collected * self::COMMISSION_PCT, 100);
    }

    /** Sıra başına havuz payı [1., 2., 3.] (komisyon düşülmüş; artık şampiyona). */
    public static function shares(Tournament $t): array
    {
        if (! self::enabled($t)) {
            return [];
        }
        $collected = self::collected($t);
        $net = $collected - self::commission($collected);
        if ($net <= 0) {
            return [0, 0, 0];
        }
        $shares = [];
        foreach (self::pcts($t) as $pct) {
            $shares[] = intdiv($net * $pct, 100);
        }
        // Yüzdeler toplamı 100 ise yuvarlama artığı şampiyona (fazladan basma yok: sum <= net).
        if (array_sum(self::pcts($t)) === 100) {
            $shares[0] += $net - array_sum($shares);
        }

        return $shares;
    }

    /** Ödül tablosu + havuz payları birleşik (payPrizes bunu dağıtır). */
    public static function effectivePrizes(Tournament $t): array
    {
        $prizes = is_array($t->prizes) ? array_values($t->prizes) : [];
        $shares = self::shares($t);
        if (array_sum($shares) <= 0) {
            return $prizes;
        }
        foreach ($shares as $i => $coins) {
            // 3 sıranın satırı HER ZAMAN oluşur (0 paylı ara sıra boşluk bırakıp kaydırmasın).
            $row = $prizes[$i] ?? ['coins' => 0, 'desc' => null];
            $row['coins'] = (int) ($row['coins'] ?? 0) + $coins;
            $prizes[$i] = $row;
        }
        ksort($prizes);

        return array_values($prizes);
    }

    /** Komisyonu ledger'a yaz (raporlama; kimseye kredi edilmez). Ödeme anında bir kez çağrılır. */
    public static function recordCommission(Tournament $t, ?int $championId): void
    {
        if (! self::enabled($t)) {
            return;
        }
        $collected = self::collected($t);
        $c = self::commission($collected);
        if ($c <= 0) {
            return;
        }
        Commission::create([
            'room_code' => 'T'.$t->id, // turnuva komisyonu (oda değil)
            'winner_id' => $championId ?: null,
            'loser_id' => null,
            'stake' => $collected,
            'commission' => $c,
            'pct' => self::COMMISSION_PCT,
        ]);
    }
}
