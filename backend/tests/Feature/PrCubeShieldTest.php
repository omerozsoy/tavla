<?php

namespace Tests\Feature;

use App\Services\Analysis\AnalysisOrchestrator;
use Tests\TestCase;

/**
 * Küp PR PR'dan çıkarıldı (kullanıcı kararı): genel PR = YALNIZ pul (checker) oyunu, HER maçta.
 * cube_pr daima null (gösterimde "—"); küp kararı sayısı fark etmez.
 */
class PrCubeShieldTest extends TestCase
{
    private function log(int $cubeCount): array
    {
        // 1 checker kararı: spread > OBVIOUS, loss 0.1 -> checker_pr = 50.
        $log = [['player' => 'white', 'cands' => [['equity' => 0.5], ['equity' => 0.3]], 'loss' => 0.1]];
        // K küp kararı: 'double' kötü (loss 1.18) — ARTIK genel PR'a KATILMAMALI.
        for ($i = 0; $i < $cubeCount; $i++) {
            $log[] = ['player' => 'white', 'cube' => [
                'chosen' => 'double',
                'equities' => ['noDouble' => -0.722, 'doubleTake' => -1.902, 'doublePass' => 1.0],
            ]];
        }

        return $log;
    }

    public function test_cube_excluded_from_pr_regardless_of_count(): void
    {
        $orch = app(AnalysisOrchestrator::class);
        foreach ([0, 2, 5] as $k) {
            $r = $orch->prFromReviewLog($this->log($k), 'white');
            $this->assertNull($r['cube_pr'], "cube_pr daima null olmalı (k=$k)");
            // Genel PR yalnız checker: (0.1/1)*500 = 50 — küp kararı sayısından BAĞIMSIZ.
            $this->assertEqualsWithDelta(50.0, $r['pr'], 0.01, "genel PR küpsüz olmalı (k=$k)");
            $this->assertSame($k, $r['cube_decisions'], 'küp karar sayısı yine raporlanır (bilgi)');
        }
    }
}
