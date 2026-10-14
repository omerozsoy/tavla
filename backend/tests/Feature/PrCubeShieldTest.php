<?php

namespace Tests\Feature;

use App\Services\Analysis\AnalysisOrchestrator;
use Tests\TestCase;

/**
 * GENEL PR = YALNIZ pul (checker) oyunu (kullanıcı kararı): küp GENEL PR'a KATILMAZ, daha düşük/stabil.
 * Küp verisi (cube_pr gated + cube_equity_lost) yine hesaplanır -> profilde KARİYER küp PR'ı için.
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

    public function test_overall_pr_is_checker_only(): void
    {
        $orch = app(AnalysisOrchestrator::class);
        // Küp kararı sayısı fark etmez -> genel PR DAİMA checker: (0.1/1)*500 = 50.
        foreach ([0, 2, 5] as $k) {
            $r = $orch->prFromReviewLog($this->log($k), 'white');
            $this->assertEqualsWithDelta(50.0, $r['pr'], 0.01, "genel PR küpsüz olmalı (k=$k)");
            $this->assertSame(1, $r['decisions'], 'decisions = yalnız checker kararları');
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
}
