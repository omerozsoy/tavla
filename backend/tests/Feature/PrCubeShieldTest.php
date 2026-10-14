<?php

namespace Tests\Feature;

use App\Services\Analysis\AnalysisOrchestrator;
use Tests\TestCase;

/**
 * Birleşik PR (standart): genel PR = checker + küp, TÜM kararlar üzerinden (küp loss GENEL PR'a dahil).
 * Ayrı "Küp PR" göstergesi yalnız >= MIN_CUBE_DECISIONS küp kararında gösterilir (azsa null -> "—",
 * 2 kararda 430 gibi uç değer gösterilmez). Min-karar kapısı (genel PR null) prFromReviewLog'da DEĞİL.
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

    public function test_cube_in_overall_but_gauge_hidden_when_few(): void
    {
        $orch = app(AnalysisOrchestrator::class);
        // 2 küp kararı (< 3): küp GENEL PR'a katılır ama ayrı cube_pr göstergesi GİZLİ (null).
        // genel pr = (0.1 + 2*1.18)/(1+2) *500 = 410.
        $r = $orch->prFromReviewLog($this->log(2), 'white');
        $this->assertEqualsWithDelta(410.0, $r['pr'], 0.5, 'küp GENEL PR\'a dahil olmalı');
        $this->assertNull($r['cube_pr'], 'az küp kararında ayrı Küp PR göstergesi gizli (null)');
    }

    public function test_cube_gauge_shown_when_enough(): void
    {
        $orch = app(AnalysisOrchestrator::class);
        // 3 küp kararı (>= 3): cube_pr gösterilir = (3*1.18/3)*500 = 590; genel = (0.1+3*1.18)/4*500 = 455.
        $r = $orch->prFromReviewLog($this->log(3), 'white');
        $this->assertEqualsWithDelta(590.0, $r['cube_pr'], 0.5, '3+ küp kararında Küp PR gösterilir');
        $this->assertEqualsWithDelta(455.0, $r['pr'], 0.5);
    }
}
