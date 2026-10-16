<?php

namespace Tests\Feature;

use App\Services\Analysis\AnalysisOrchestrator;
use Tests\TestCase;

/**
 * GENEL PR = XG/gnubg HAVUZLANMIŞ (pul + küp birlikte): overall = (Σloss / Σkarar) × 500.
 * Küp kaybı overall havuzuna DAİMA girer; ayrı cube_pr GÖSTERİMİ ise ≥MIN_CUBE_DECISIONS ile
 * stabilize edilir (az küp kararında gürültülü değer gösterilmez), cube_equity_lost kariyer için toplanır.
 */
class PrCubeShieldTest extends TestCase
{
    private function log(int $cubeCount): array
    {
        // 1 checker kararı: spread > OBVIOUS, loss 0.1 -> checker_pr = 50.
        $log = [['player' => 'white', 'cands' => [['equity' => 0.5], ['equity' => 0.3]], 'loss' => 0.1]];
        for ($i = 0; $i < $cubeCount; $i++) {
            $log[] = ['player' => 'white', 'cube' => [
                'chosen' => 'double',
                'equities' => ['noDouble' => -0.722, 'doubleTake' => -1.902, 'doublePass' => 1.0],
            ]];
        }

        return $log;
    }

    public function test_overall_pr_is_pooled_checker_plus_cube(): void
    {
        $orch = app(AnalysisOrchestrator::class);
        // Overall = HAVUZ: 1 checker (loss 0.1) + k küp (her biri loss 1.18) -> (0.1 + k*1.18)/(1+k)*500.
        //   k=0 -> 50 ; k=2 -> (2.46/3)*500 = 410 ; k=5 -> (6.0/6)*500 = 500. decisions = 1+k (pul+küp).
        foreach ([[0, 50.0], [2, 410.0], [5, 500.0]] as [$k, $expected]) {
            $r = $orch->prFromReviewLog($this->log($k), 'white');
            $this->assertEqualsWithDelta($expected, $r['pr'], 0.5, "overall havuz (pul+küp) olmalı (k=$k)");
            $this->assertSame(1 + $k, $r['decisions'], 'decisions = pul + küp kararları (havuz)');
        }
    }

    public function test_cube_data_still_computed(): void
    {
        $orch = app(AnalysisOrchestrator::class);
        // 2 küp (<3): ayrı cube_pr göstergesi null; ama cube_equity_lost toplanır (kariyer için).
        $r2 = $orch->prFromReviewLog($this->log(2), 'white');
        $this->assertNull($r2['cube_pr']);
        $this->assertGreaterThan(0, $r2['cube_equity_lost']);
        $this->assertSame(2, $r2['cube_decisions']);
        // 3 küp (>=3): cube_pr gösterilir = (3*1.18/3)*500 = 590.
        $r3 = $orch->prFromReviewLog($this->log(3), 'white');
        $this->assertEqualsWithDelta(590.0, $r3['cube_pr'], 0.5);
    }

    /**
     * ÇÖP KALKANI: gnubg bazı küp pozisyonlarında makul-dışı equity döndürüp PR'ı milyonlara
     * şişiriyordu (maç 778: cube_pr 33.333.136). Makul-dışı (|eq|>3) / NaN / sonsuz equity'li küp
     * kararı SAYILMAMALI -> PR patlamaz, yalnız geçerli kararlardan hesaplanır.
     */
    public function test_garbage_cube_equity_is_ignored(): void
    {
        $orch = app(AnalysisOrchestrator::class);
        // 1 geçerli checker (loss 0.1 -> checker_pr 50) + 1 ÇÖP küp (doubleTake=-200000) -> çöp atılır.
        $log = [
            ['player' => 'white', 'cands' => [['equity' => 0.5], ['equity' => 0.3]], 'loss' => 0.1],
            ['player' => 'white', 'cube' => [
                'chosen' => 'drop',
                'equities' => ['noDouble' => 0.6, 'doubleTake' => -200000.0, 'doublePass' => 1.0],
            ]],
            // NaN/sonsuz de atılmalı (JSON'dan gelebilir).
            ['player' => 'white', 'cube' => [
                'chosen' => 'double',
                'equities' => ['noDouble' => INF, 'doubleTake' => 0.1, 'doublePass' => 1.0],
            ]],
        ];
        $r = $orch->prFromReviewLog($log, 'white');
        $this->assertSame(0, $r['cube_decisions'], 'çöp küp kararları sayılmamalı');
        $this->assertSame(1, $r['decisions'], 'yalnız geçerli checker sayılmalı');
        $this->assertEqualsWithDelta(50.0, $r['pr'], 0.5, 'PR çöpten patlamamalı (yalnız checker)');
    }
}
