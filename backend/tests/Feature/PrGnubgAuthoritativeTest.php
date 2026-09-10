<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeMatchPrJob;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ANA KURAL (A→Z gnubg): pr_mode=authoritative iken gosterilen/otoriter PR = gnubg (cubeful EMG),
 * istemci wildbg PR'i EZILIR. shadow/off iken otoriter pr'a DOKUNULMAZ (yalniz gnubg_* shadow).
 */
class PrGnubgAuthoritativeTest extends TestCase
{
    use RefreshDatabase;

    /** gnubg'yi taklit eden orkestrator (servis cagirmadan sabit PR dondurur). */
    private function fakeOrch(float $chkPr, float $chkLoss, int $chkDec): AnalysisOrchestrator
    {
        return new class($this->app->make(GnuBgClient::class), $chkPr, $chkLoss, $chkDec) extends AnalysisOrchestrator
        {
            public function __construct(GnuBgClient $g, private float $p, private float $l, private int $d)
            {
                parent::__construct($g);
            }

            public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2): array
            {
                return ['pr' => $this->p, 'loss' => $this->l, 'decisions' => $this->d, 'evaluated' => $this->d,
                    'skipped' => 0, 'strictPr' => $this->p, 'loosePr' => $this->p, 'skipReasons' => [],
                    'firstSkip' => null, 'perDecision' => []];
            }

            public function cubePr(array $log, string $player, int $matchLength = 0): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 0,
                    'strictPr' => null, 'loosePr' => null, 'perDecision' => []];
            }
        };
    }

    private function matchWithLog(float $clientPr): MatchResult
    {
        $u = User::factory()->create();

        return MatchResult::create([
            'user_id' => $u->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 3, 'match_type' => 'match', 'pr' => $clientPr,
            'pr_equity_lost' => 0.5, 'pr_decisions' => 10, // istemci (wildbg) totalleri
            'log' => json_encode(['hc' => 'white', 'log' => [
                ['player' => 'white', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [3, 1], 'playedSteps' => [[8, 5]]],
            ]]),
        ]);
    }

    public function test_authoritative_overwrites_pr_with_gnubg(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $mr = $this->matchWithLog(clientPr: 12.0); // istemci wildbg: 12 (sisirilmis)

        // gnubg: checker loss 0.048 / 6 karar -> overall = (0.048/6)*500 = 4.0
        (new AnalyzeMatchPrJob($mr->id))->handle($this->fakeOrch(chkPr: 4.0, chkLoss: 0.048, chkDec: 6));

        $mr->refresh();
        $this->assertEqualsWithDelta(4.0, (float) $mr->pr, 1e-6, 'otoriter PR gnubg olmali');
        $this->assertEqualsWithDelta(0.048, (float) $mr->pr_equity_lost, 1e-6);
        $this->assertSame(6, (int) $mr->pr_decisions);
        $this->assertEqualsWithDelta(4.0, (float) $mr->gnubg_pr, 1e-6);
    }

    public function test_shadow_does_not_touch_authoritative_pr(): void
    {
        config(['gnubg.pr_mode' => 'shadow']);
        $mr = $this->matchWithLog(clientPr: 12.0);

        (new AnalyzeMatchPrJob($mr->id))->handle($this->fakeOrch(chkPr: 4.0, chkLoss: 0.048, chkDec: 6));

        $mr->refresh();
        $this->assertEqualsWithDelta(12.0, (float) $mr->pr, 1e-6, 'shadow: otoriter PR degismemeli');
        $this->assertEqualsWithDelta(4.0, (float) $mr->gnubg_pr, 1e-6, 'shadow: gnubg_pr yine dolmali');
    }
}
