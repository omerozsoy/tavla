<?php

namespace Tests\Unit;

use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\GnuBg\GnuBgClient;
use PHPUnit\Framework\TestCase;

/**
 * Test yardımcısı: Orchestrator artık analyzeBackgroundBatch() (paralel) çağırıyor; sahteler
 * analyzeBackground()'u ezdiği için batch'i ona (log sırasında) delege ederiz -> array_shift
 * sıralı sahteler bozulmadan çalışır.
 */
trait FakeGnubgBatch
{
    public function analyzeBackgroundBatch(array $positions, ?callable $onProgress = null): array
    {
        $out = [];
        foreach ($positions as $k => $p) {
            $out[$k] = $this->analyzeBackground($p);
        }
        if ($onProgress !== null && $positions !== []) {
            $onProgress(count($positions)); // ilerleme: tüm pozisyonlar bitti (gerçek batch'i aynalar)
        }

        return $out;
    }
}

/**
 * AnalysisOrchestrator::checkerPr XG mantığını sunucu/gnubg GEREKMEDEN doğrular.
 * GnuBgClient sahte (canned /analyze yanıtları) ile değiştirilir. Orchestrator arka plan havuzunu
 * (analyzeBackground) kullandığı için sahteler o metodu ezer.
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
            use FakeGnubgBatch;

            public array $responses = [];

            public function analyzeBackground(array $position): ?array
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
            use FakeGnubgBatch;

            public function analyzeBackground(array $position): ?array
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
            use FakeGnubgBatch;

            public function analyzeBackground(array $position): ?array
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
            use FakeGnubgBatch;

            public array $captured = [];

            public function analyzeBackground(array $position): ?array
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

    private function cubeFake(): GnuBgClient
    {
        // Örnek gnubg cube analizi: noDouble +0.385, doubleTake +0.301, doublePass +1.000.
        return new class extends GnuBgClient
        {
            use FakeGnubgBatch;

            public function analyzeBackground(array $position): ?array
            {
                return ['cube' => ['equities' => ['noDouble' => 0.385, 'doubleTake' => 0.301, 'doublePass' => 1.000]]];
            }
        };
    }

    private function cubeEntry(string $chosen): array
    {
        return ['player' => 'white', 'pos' => ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white'],
            'cube' => ['chosen' => $chosen]];
    }

    public function test_cube_pr_offer_wrong_double(): void
    {
        // No double doğru (0.385) iken DOUBLE oynamak -> kayıp 0.385-0.301=0.084 -> PR 42.
        $r = (new AnalysisOrchestrator($this->cubeFake()))->cubePr([$this->cubeEntry('double')], 'white', 0);
        $this->assertSame(1, $r['decisions']);
        $this->assertEqualsWithDelta(42.0, $r['pr'], 0.1);
    }

    public function test_cube_pr_offer_correct_nodouble(): void
    {
        // No double doğru -> kayıp 0 (ama sayılır: best-worst spread büyük) -> PR 0.
        $r = (new AnalysisOrchestrator($this->cubeFake()))->cubePr([$this->cubeEntry('no-double')], 'white', 0);
        $this->assertSame(1, $r['decisions']);
        $this->assertSame(0.0, $r['pr']);
    }

    public function test_cube_pr_wrong_drop(): void
    {
        // Take doğru (-0.301) iken DROP/pass (-1) -> kayıp 0.699 -> PR ~349.5.
        $r = (new AnalysisOrchestrator($this->cubeFake()))->cubePr([$this->cubeEntry('drop')], 'white', 0);
        $this->assertEqualsWithDelta(349.5, $r['pr'], 0.5);
    }

    /**
     * İLERLEME ÇUBUĞU: countPositions, checkerPr+cubePr'ın gnubg'ye GERÇEKTEN gönderdiği pozisyon
     * sayısıyla BİREBİR eşleşmeli (yüzde = analiz/toplam doğru olsun). Karışık log üstünde doğrula:
     * geçerli checker + fill(skip) + eksik(skip) + geçerli cube + geçersiz cube(skip) + rakip(skip).
     */
    public function test_count_positions_matches_sent_to_gnubg(): void
    {
        $fake = new class extends GnuBgClient
        {
            public int $sent = 0;

            public function analyzeBackgroundBatch(array $positions, ?callable $onProgress = null): array
            {
                $this->sent += count($positions);
                $out = [];
                foreach ($positions as $k => $p) {
                    // checker (dice dolu) vs cube (dice boş) -> uygun sahte yanıt.
                    $out[$k] = empty($p['dice'])
                        ? ['cube' => ['equities' => ['noDouble' => 0.385, 'doubleTake' => 0.301, 'doublePass' => 1.0]]]
                        : ['result' => ['hint' => [['move' => 'a', 'equity' => 0.2], ['move' => 'b', 'equity' => -0.3]]],
                            'played' => ['move' => 'b', 'loss' => 0.05]];
                }
                if ($onProgress !== null && $positions !== []) {
                    $onProgress(count($positions));
                }

                return $out;
            }
        };
        $log = [
            $this->entry(), // geçerli white checker
            $this->entry(), // geçerli white checker
            ['player' => 'white', 'fill' => true, 'pos' => $this->pos(), 'dice' => [1, 1], 'playedSteps' => [['from' => 1, 'to' => 2]]], // fill -> skip
            ['player' => 'white', 'pos' => $this->pos()], // eksik (dice/steps yok) -> skip
            $this->cubeEntry('double'), // geçerli white cube
            ['player' => 'white', 'cube' => ['chosen' => 'xyz'], 'pos' => $this->pos()], // geçersiz cube -> skip
            ['player' => 'black', 'pos' => $this->pos(), 'dice' => [2, 2], 'playedSteps' => [['from' => 5, 'to' => 7]]], // rakip -> skip
        ];

        $orch = new AnalysisOrchestrator($fake);
        $this->assertSame(3, $orch->countPositions($log, 'white'), '2 checker + 1 cube = 3');

        $total = 0;
        $onProg = function (int $n) use (&$total) { $total += $n; };
        $orch->checkerPr($log, 'white', 0, 2, $onProg);
        $orch->cubePr($log, 'white', 0, $onProg);
        $this->assertSame(3, $fake->sent, 'gnubg’ye tam 3 pozisyon gönderildi (countPositions ile eşit)');
        $this->assertSame(3, $total, 'onProgress toplamı = gönderilen pozisyon = countPositions');
    }
}
