<?php

namespace Tests\Unit;

use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\GnuBg\GnuBgClient;
use PHPUnit\Framework\TestCase;

/**
 * AnalysisOrchestrator::checkerPr XG mantığını sunucu/gnubg GEREKMEDEN doğrular.
 * GnuBgClient sahte (canned /analyze yanıtları) ile değiştirilir.
 */
class AnalysisOrchestratorTest extends TestCase
{
    private function pos(): array
    {
        return ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0]];
    }

    private function entry(): array
    {
        return ['player' => 'white', 'pos' => $this->pos(), 'dice' => [3, 1],
            'playedSteps' => [['from' => 1, 'to' => 2, 'die' => 1]]];
    }

    public function test_checker_pr_counts_only_non_obvious_non_forced(): void
    {
        $fake = new class extends GnuBgClient
        {
            public array $responses = [];

            public function analyze(array $position): ?array
            {
                return array_shift($this->responses);
            }
        };
        // 1) sayılan: spread büyük, loss 0.05
        // 2) obvious: spread < 0.001 -> sayılmaz (ama evaluated + allLoss)
        // 3) forced: tek aday -> sayılmaz
        $fake->responses = [
            ['result' => ['hint' => [['move' => 'a', 'equity' => 0.20], ['move' => 'b', 'equity' => -0.30]]],
                'played' => ['move' => 'b', 'loss' => 0.05]],
            ['result' => ['hint' => [['move' => 'a', 'equity' => 0.10], ['move' => 'b', 'equity' => 0.0999]]],
                'played' => ['move' => 'b', 'loss' => 0.0001]],
            ['result' => ['hint' => [['move' => 'a', 'equity' => 0.50]]],
                'played' => ['move' => 'a', 'loss' => 0.0]],
        ];
        $log = [$this->entry(), $this->entry(), $this->entry(),
            ['player' => 'black', 'pos' => $this->pos(), 'dice' => [2, 2], 'playedSteps' => [['from' => 5, 'to' => 7]]]];

        $orch = new AnalysisOrchestrator($fake);
        $r = $orch->checkerPr($log, 'white', 0, 2);

        $this->assertSame(3, $r['evaluated'], 'siyah elenir, 3 beyaz değerlendirilir');
        $this->assertSame(1, $r['decisions'], 'yalnız 1 karar sayılır (obvious+forced elenir)');
        $this->assertEqualsWithDelta(25.0, $r['pr'], 0.001, 'PR = (0.05/1)*500 = 25');
        $this->assertNotNull($r['pr']);
    }

    public function test_pr_never_null_all_skipped(): void
    {
        $fake = new class extends GnuBgClient
        {
            public function analyze(array $position): ?array
            {
                return null; // gnubg erişilemez
            }
        };
        $orch = new AnalysisOrchestrator($fake);
        $r = $orch->checkerPr([$this->entry()], 'white', 0, 2);

        $this->assertSame(0, $r['evaluated']);
        $this->assertSame(0.0, $r['pr'], 'DİREKTİF: PR asla null -> 0');
        $this->assertNull($r['strictPr']);
        $this->assertNull($r['loosePr']);
    }

    public function test_loose_fallback_when_no_counted(): void
    {
        // Değerlendirilen var ama hepsi obvious (sayılmaz) -> strict null, loose devreye girer, PR asla null.
        $fake = new class extends GnuBgClient
        {
            public function analyze(array $position): ?array
            {
                return ['result' => ['hint' => [['move' => 'a', 'equity' => 0.10], ['move' => 'b', 'equity' => 0.0999]]],
                    'played' => ['move' => 'b', 'loss' => 0.02]];
            }
        };
        $orch = new AnalysisOrchestrator($fake);
        $r = $orch->checkerPr([$this->entry()], 'white', 0, 2);

        $this->assertSame(1, $r['evaluated']);
        $this->assertSame(0, $r['decisions']);
        $this->assertNull($r['strictPr']);
        $this->assertEqualsWithDelta(10.0, $r['loosePr'], 0.001, 'loose = (0.02/1)*500 = 10');
        $this->assertEqualsWithDelta(10.0, $r['pr'], 0.001, 'PR loose fallback (asla null)');
    }

    public function test_mctx_makes_analysis_match_aware(): void
    {
        $fake = new class extends GnuBgClient
        {
            public array $captured = [];

            public function analyze(array $position): ?array
            {
                $this->captured[] = $position;

                return ['result' => ['hint' => [['move' => 'a', 'equity' => 0.2], ['move' => 'b', 'equity' => -0.3]]],
                    'played' => ['move' => 'b', 'loss' => 0.05]];
            }
        };
        $entry = ['player' => 'white', 'pos' => $this->pos(), 'dice' => [3, 1],
            'playedSteps' => [['from' => 1, 'to' => 2]],
            'mctx' => ['score' => ['white' => 2, 'black' => 1], 'cube' => 2, 'cubeOwner' => 'white',
                'crawford' => false, 'matchLen' => 5]];

        $orch = new AnalysisOrchestrator($fake);
        $orch->checkerPr([$entry], 'white', 0, 2); // fallback matchLength 0, ama mctx.matchLen=5 kazanır

        $sent = $fake->captured[0];
        $this->assertSame(5, $sent['matchLength'], 'mctx.matchLen match-aware kullanılır');
        $this->assertSame(['white' => 2, 'black' => 1], $sent['score']);
        $this->assertSame(2, $sent['cube']['value']);
        $this->assertSame('white', $sent['cube']['owner']);
    }
}
