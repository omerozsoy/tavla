<?php

namespace App\Support;

use App\Models\Commission;
use App\Models\Tournament;

/**
 * Otomatik Ödül Havuzu (turnuva kurulurken "Otomatik Ödül Havuzu: Evet").
 * Havuz = kayıtlı oyuncuların GERÇEKTEN ödediği giriş ücretleri (players[].fee_paid; kayıt açıkken
 * çekilen/iptal edilen zaten listeden çıkıp iade alır). Havuzun %COMMISSION_PCT'si komisyon, KALANI
 * (net) sıra paylarına ORANLA (pct/Σpct) bölünür; yuvarlama artığı şampiyona.
 *
 * Varsayılan modeller (tür'e göre, düzenlenebilir):
 *  - Bracket: Şampiyon %40 · Finalist %20 · Yarı finalist %15 · Yarı finalist %15.
 *  - Swiss  : 1.%30 · 2.%18 · 3.%11 · 4.-5. %8 · 6.-8. %5 (kişi başı).
 * Komisyon %10 ile toplam %100. Eşit paylı ardışık sıralar (iki yarı finalist / 4.-5. / 6.-8.) aynı
 * dereceyi paylaşır -> PrizeDistribution tie grubunda eşit bölüşür (oran zaten eşit olduğundan tutar).
 */
class TournamentPool
{
    public const COMMISSION_PCT = 10;

    // Varsayılan sıra payları (net havuzun ORANI; komisyon %10 ayrı). Toplam pay + komisyon = %100.
    public const PCTS_BRACKET = [40, 20, 15, 15];

    public const PCTS_SWISS = [30, 18, 11, 8, 8, 5, 5, 5];

    public static function enabled(Tournament $t): bool
    {
        return (bool) ($t->pool_enabled ?? false);
    }

    /** Turnuva tipine göre varsayılan model (admin override etmezse bu kullanılır). */
    public static function defaultPcts(?string $type): array
    {
        return Tournament::isSwissType($type) ? self::PCTS_SWISS : self::PCTS_BRACKET;
    }

    /** Geçerli sıra payları: admin'in düzenlediği (pool_pcts) varsa o, yoksa tür varsayılanı. */
    public static function pcts(Tournament $t): array
    {
        $override = self::normalizePcts(is_array($t->pool_pcts) ? $t->pool_pcts : []);
        if ($override !== [] && array_sum($override) > 0) {
            return $override;
        }

        return self::defaultPcts($t->type);
    }

    /** Form/DB'den gelen payları düz int listesine çevir: [{pct:40}], [40,..] veya eski {p1,p2,p3}. */
    private static function normalizePcts(array $raw): array
    {
        if (isset($raw['p1']) || isset($raw['p2']) || isset($raw['p3'])) {
            $raw = [$raw['p1'] ?? 0, $raw['p2'] ?? 0, $raw['p3'] ?? 0];
        }
        $out = [];
        foreach ($raw as $v) {
            $n = is_array($v) ? ($v['pct'] ?? 0) : $v; // Filament Repeater item'i {pct:N}
            $out[] = max(0, (int) $n);
        }

        return $out;
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

    /** Sıra başına havuz payı: net (collected − komisyon) paylara ORANLA bölünür, artık şampiyona. */
    public static function shares(Tournament $t): array
    {
        if (! self::enabled($t)) {
            return [];
        }
        $pcts = self::pcts($t);
        $totalPct = array_sum($pcts);
        $collected = self::collected($t);
        if ($collected <= 0 || $totalPct <= 0) {
            return array_fill(0, count($pcts), 0);
        }
        $net = $collected - self::commission($collected); // oyunculara kalan
        $shares = [];
        foreach ($pcts as $pct) {
            $shares[] = intdiv($net * $pct, $totalPct); // pay = net'in (pct/Σpct) oranı
        }
        // Yuvarlama artığı şampiyona (korunum: Σpay == net, ne fazla ne eksik basar).
        $shares[0] += $net - array_sum($shares);

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
            // Model sıralarının satırı HER ZAMAN oluşur (0 paylı ara sıra boşluk bırakıp kaydırmasın).
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
