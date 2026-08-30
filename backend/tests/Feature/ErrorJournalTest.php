<?php

namespace Tests\Feature;

use App\Models\DecisionAnalysis;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\ErrorJournalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Hata Gunlugu: log -> analiz -> persist -> ozet + endpoint (uctan uca, DB'li).
class ErrorJournalTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'first_name' => 'p', 'last_name' => 'T', 'country' => '',
            'nickname' => 'p1', 'email' => 'p1@example.com', 'password' => bcrypt('secret123'),
        ]);
    }

    /** index=>signed count -> 24'luk points + GameState. */
    private function pos(array $map): array
    {
        $p = array_fill(0, 24, 0);
        foreach ($map as $i => $c) {
            $p[$i] = $c;
        }

        return ['points' => $p, 'bar' => ['white' => 0, 'black' => 0], 'off' => ['white' => 0, 'black' => 0]];
    }

    /** Sentetik mac log'u: hc=white, 5 giris (biri siyah, biri cube -> atlanir). */
    private function log(): string
    {
        $holding = $this->pos([19 => 2, 12 => 3, 7 => 3, 5 => 5, 4 => 2, 8 => -3, 13 => -5, 16 => -4, 21 => -3]);
        $middle = $this->pos([6 => 2, 7 => 3, 8 => 2, 12 => 3, 13 => 3, 16 => 2, 10 => -2, 11 => -3, 15 => -3, 17 => -2, 20 => -5]);
        $start = $this->pos([0 => -2, 5 => 5, 7 => 3, 11 => -5, 12 => 5, 16 => -3, 18 => -5, 23 => 2]);

        return json_encode([
            'hc' => 'white',
            'log' => [
                // 0: blunder (white)
                ['player' => 'white', 'notation' => '13/7 8/5', 'best' => '24/18 13/10', 'loss' => 0.084,
                    'dice' => [6, 3], 'pos' => $holding, 'steps' => [], 'playedSteps' => [],
                    'cands' => [['notation' => '24/18 13/10', 'equity' => 0.412]]],
                // 1: rakip karari (siyah) -> atlanir
                ['player' => 'black', 'notation' => '6/1', 'best' => '6/1', 'loss' => 0.2,
                    'dice' => [5, 1], 'pos' => $middle],
                // 2: perfect (white) -> hata degil ama karar sayilir
                ['player' => 'white', 'notation' => '24/23 13/9', 'best' => '24/23 13/9', 'loss' => 0.0,
                    'dice' => [4, 1], 'pos' => $start, 'cands' => [['notation' => '24/23 13/9', 'equity' => 0.05]]],
                // 3: mistake (white)
                ['player' => 'white', 'notation' => '13/8 6/3', 'best' => '13/8 13/10', 'loss' => 0.05,
                    'dice' => [5, 3], 'pos' => $middle, 'cands' => [['notation' => '13/8 13/10', 'equity' => 0.14]]],
                // 4: cube karari -> atlanir
                ['player' => 'white', 'cube' => ['recommended' => 'double-take', 'chosen' => 'no-double', 'correct' => false]],
            ],
        ]);
    }

    private function match(User $u): MatchResult
    {
        return MatchResult::create([
            'user_id' => $u->id, 'won' => true,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 5, 'match_type' => 'match', 'pr' => 4.2, 'log' => $this->log(),
        ]);
    }

    public function test_analyze_persists_only_user_checker_decisions(): void
    {
        $u = $this->user();
        $mr = $this->match($u);
        $n = app(ErrorJournalService::class)->analyzeMatch($mr);

        // white checker kararlari: 0,2,3 = 3 (siyah + cube atlanir)
        $this->assertSame(3, $n);
        $this->assertSame(3, DecisionAnalysis::where('match_result_id', $mr->id)->count());
        $this->assertSame(2, DecisionAnalysis::whereNotNull('severity')->count()); // blunder + mistake
        $this->assertNotNull($mr->fresh()->analyzed_at);
    }

    public function test_analyze_is_idempotent(): void
    {
        $u = $this->user();
        $mr = $this->match($u);
        $svc = app(ErrorJournalService::class);
        $svc->analyzeMatch($mr);
        $svc->analyzeMatch($mr, true); // force -> yeniden uret, duplicate YOK
        $this->assertSame(3, DecisionAnalysis::where('match_result_id', $mr->id)->count());
    }

    public function test_summary_counts_and_error_rate(): void
    {
        $u = $this->user();
        app(ErrorJournalService::class)->analyzeMatch($this->match($u));

        $summary = app(ErrorJournalService::class)->summary($u, null, null);
        $this->assertSame(3, $summary['decisionsAnalyzed']);
        $this->assertSame(1, $summary['gamesAnalyzed']);
        $this->assertSame(2, $summary['totalErrors']);
        $this->assertSame(1, $summary['blunders']);
        $this->assertSame(1, $summary['mistakes']);
        $this->assertSame(0, $summary['inaccuracies']);
        // her kategori icin errorRate = errors/decisions
        foreach ($summary['categories'] as $c) {
            $expected = $c['decisions'] > 0 ? round($c['errors'] / $c['decisions'], 4) : 0.0;
            $this->assertSame($expected, $c['errorRate']);
        }
    }

    public function test_endpoint_returns_summary_and_entries(): void
    {
        $u = $this->user();
        app(ErrorJournalService::class)->analyzeMatch($this->match($u));
        Sanctum::actingAs($u);

        $res = $this->getJson('/api/me/error-journal?period=all');
        $res->assertOk()
            ->assertJsonPath('summary.totalErrors', 2)
            ->assertJsonPath('summary.blunders', 1)
            ->assertJsonCount(17, 'categoryOrder');

        // entries: yalniz hatalar (2), board pozisyonu ekli
        $entries = $res->json('entries');
        $this->assertCount(2, $entries);
        $this->assertArrayHasKey('position', $entries[0]);
        $this->assertNotNull($entries[0]['position']);
        $this->assertSame([6, 3], $entries[0]['dice']); // en yuksek loss ilk (blunder 0.084, dice 6-3)
    }

    public function test_backfill_command(): void
    {
        $u = $this->user();
        $this->match($u); // analiz edilmemis
        $this->artisan('error-journal:backfill')->assertSuccessful();
        $this->assertSame(3, DecisionAnalysis::where('user_id', $u->id)->count());
    }
}
