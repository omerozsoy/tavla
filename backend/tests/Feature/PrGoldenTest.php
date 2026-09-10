<?php

namespace Tests\Feature;

use App\Support\PrPool;
use Tests\TestCase;

/**
 * GOLDEN / REGRESYON: gosterilen PR = log’dan havuzlanan (PrPool) matematik. Bu test SABIT bir
 * log’u kilitler; PR zincirinde (payda/error/×500) istemsiz bir degisiklik olursa KIRILIR.
 *
 * NOT (XG paritesi): XG ciktisiyla BIREBIR golden icin buraya gercek bir MAT + XG PR’i gomulmeli
 * ve tolerans ( or. |Tavlai − XG| < 0.5) eklenmeli. XG farkinin KOK NEDENI (motor: wildbg cubeless
 * money vs XG cubeful match-equity) cozulmeden tolerans BUYUTULMEMELI. Su an bu test yalnizca
 * KENDI matematigimizin kararliligini (denominator + error + ×500) sabitler.
 */
class PrGoldenTest extends TestCase
{
    /** Sabit log: 4 sayilan karar (3 checker + 1 cube), 1 obvious, 1 fill (dolgu). */
    private function fixedLog(): string
    {
        return json_encode([
            'hc' => 'white',
            'log' => [
                // checker — sayilan (payda), error 0.030
                ['player' => 'white', 'loss' => 0.030, 'countsForPR' => true, 'prAdjustedEquityLoss' => 0.030],
                // checker — sayilan ama kusursuz (loss 0) -> paydaya girer, error 0
                ['player' => 'white', 'loss' => 0.000, 'countsForPR' => true, 'prAdjustedEquityLoss' => 0.000],
                // checker — OBVIOUS (spread<esik) -> paydaya GIRMEZ
                ['player' => 'white', 'loss' => 0.0005, 'countsForPR' => false, 'prAdjustedEquityLoss' => 0.0005],
                // cube — sayilan, error 0.020
                ['player' => 'white', 'cube' => ['chosen' => 'take'], 'countsForPR' => true, 'prAdjustedEquityLoss' => 0.020],
                // fill (MAT tur-sirasi dolgusu / no-move) -> ELENIR
                ['player' => 'white', 'fill' => true],
                // checker — sayilan, error 0.010
                ['player' => 'white', 'loss' => 0.010, 'countsForPR' => true, 'prAdjustedEquityLoss' => 0.010],
            ],
        ]);
    }

    public function test_pooled_pr_from_fixed_log(): void
    {
        $totals = PrPool::totalsFromLog($this->fixedLog());

        $this->assertNotNull($totals);
        // 4 sayilan karar (obvious + fill haric), toplam error 0.030+0+0.020+0.010 = 0.060
        $this->assertSame(4, $totals['decisions']);
        $this->assertEqualsWithDelta(0.060, $totals['loss'], 1e-9);

        // PR = (error / decisions) × 500
        $pr = ($totals['loss'] / $totals['decisions']) * 500;
        $this->assertEqualsWithDelta(7.5, $pr, 1e-9);
    }

    public function test_forced_and_no_move_are_never_in_denominator(): void
    {
        // Yalniz fill + obvious iceren log -> hicbir sayilan karar yok -> null (0 DEGIL).
        $json = json_encode(['hc' => 'white', 'log' => [
            ['player' => 'white', 'fill' => true],
            ['player' => 'white', 'loss' => 0.0, 'countsForPR' => false, 'prAdjustedEquityLoss' => 0.0],
        ]]);
        $this->assertNull(PrPool::totalsFromLog($json));
    }
}
