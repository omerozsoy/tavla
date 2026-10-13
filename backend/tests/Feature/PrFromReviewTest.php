<?php

namespace Tests\Feature;

use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\GnuBg\GnuBgClient;
use Tests\TestCase;

/**
 * prFromReviewLog: PR'ı gnubg_review log'undan türetir (ayrı cubePr/checkerPr re-analizi YOK).
 * Buggy cubePr'ı bypass eder; EU6CD gibi küp-hatalı atfetmeyi önler. Pure fonksiyon (gnubg çağırmaz).
 */
class PrFromReviewTest extends TestCase
{
    private function orch(): AnalysisOrchestrator
    {
        return new AnalysisOrchestrator(app(GnuBgClient::class));
    }

    public function test_pr_from_review_counts_checker_cube_excludes_obvious_and_forced(): void
    {
        $log = [
            // white: SAYILAN checker (spread 0.2 >= OBVIOUS, loss 0.1)
            ['player' => 'white', 'dice' => [3, 1], 'loss' => 0.1,
                'cands' => [['equity' => 0.5], ['equity' => 0.3]]],
            // white: OBVIOUS checker (spread 0.0001 < OBVIOUS) -> sayılmaz
            ['player' => 'white', 'dice' => [2, 2], 'loss' => 0.02,
                'cands' => [['equity' => 0.5], ['equity' => 0.4999]]],
            // white: ZORUNLU (tek aday) -> sayılmaz
            ['player' => 'white', 'dice' => [6, 6], 'loss' => 0.0,
                'cands' => [['equity' => 0.1]]],
            // white: KÜP double hatası (EU6CD seq13 ile aynı: too-good-to-redouble)
            ['player' => 'white', 'cube' => ['chosen' => 'double',
                'equities' => ['noDouble' => 1.021, 'doubleTake' => 1.385, 'doublePass' => 1.0]]],
            // black: farklı oyuncu -> white hesabına GİRMEZ
            ['player' => 'black', 'cube' => ['chosen' => 'take',
                'equities' => ['noDouble' => 1.021, 'doubleTake' => 1.385, 'doublePass' => 1.0]]],
        ];

        $r = $this->orch()->prFromReviewLog($log, 'white');

        // checker: 1 sayılan karar, loss 0.1 -> checker_pr = 0.1/1*500 = 50
        $this->assertSame(1, $r['checker_decisions']);
        $this->assertEqualsWithDelta(50.0, $r['checker_pr'], 1e-6);
        // cube: double (0.021 kayıp) sayılır -> cube_pr = 0.021/1*500 = 10.5
        $this->assertSame(1, $r['cube_decisions']);
        $this->assertEqualsWithDelta(10.5, $r['cube_pr'], 1e-3);
        // overall: (0.1 + 0.021)/2 * 500 = 30.25
        $this->assertEqualsWithDelta(0.121, $r['equity_lost'], 1e-6);
        $this->assertSame(2, $r['decisions']);
        $this->assertEqualsWithDelta(30.25, $r['pr'], 1e-3);
    }

    public function test_correct_cube_take_counts_with_zero_loss(): void
    {
        // Doğru take (take açıkça pass'tan iyi): spread >= OBVIOUS -> sayılır ama loss 0.
        $log = [
            ['player' => 'white', 'cube' => ['chosen' => 'take',
                'equities' => ['noDouble' => 0.2, 'doubleTake' => 0.1, 'doublePass' => 1.0]]],
        ];
        $r = $this->orch()->prFromReviewLog($log, 'white');
        $this->assertSame(1, $r['cube_decisions']);
        $this->assertEqualsWithDelta(0.0, $r['equity_lost'], 1e-6); // doğru take -> 0 kayıp
        $this->assertEqualsWithDelta(0.0, $r['cube_pr'], 1e-6);
    }
}
