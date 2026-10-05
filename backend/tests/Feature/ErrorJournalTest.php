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

    /** gnubg hakem: insan kararları (0,2,3) log'daki kayıplarla aynı (Hata Günlüğü yalnız gnubg satırlarını gösterir). */
    private function gnubgSame(): array
    {
        return [0 => 0.084, 2 => 0.0, 3 => 0.05];
    }

    // TEK MOTOR = gnubg: wildbg ile ölçülmüş (gnubg job'u koşmamış) kararlar Hata Günlüğü'ne girmez.
    public function test_wildbg_only_decisions_hidden_from_journal(): void
    {
        $u = $this->user();
        app(ErrorJournalService::class)->analyzeMatch($this->match($u)); // gnubg yok -> wildbg satırları
        $u->forceFill(['plan' => 'star', 'plan_until' => now()->addMonth()])->save();
        Sanctum::actingAs($u->fresh());
        $res = $this->getJson('/api/me/error-journal?period=all')->assertOk();
        $this->assertSame([], $res->json('entries'));
        $this->assertSame(0, $res->json('summary.decisionsAnalyzed'));
    }

    public function test_analyze_persists_both_sides_checker_decisions(): void
    {
        $u = $this->user();
        $mr = $this->match($u);
        $n = app(ErrorJournalService::class)->analyzeMatch($mr);

        // checker kararlari: white 0,2,3 + black 1 = 4 (cube 4 atlanir).
        // Rakip (black) kararlari da saklanir (Zar Ortalamalari); cube haric.
        $this->assertSame(4, $n);
        $this->assertSame(4, DecisionAnalysis::where('match_result_id', $mr->id)->count());
        $this->assertSame(3, DecisionAnalysis::where('match_result_id', $mr->id)->where('is_opponent', false)->count());
        $this->assertSame(1, DecisionAnalysis::where('match_result_id', $mr->id)->where('is_opponent', true)->count());
        $this->assertNotNull($mr->fresh()->analyzed_at);
    }

    public function test_gnubg_loss_override_used_for_human_decisions(): void
    {
        $u = $this->user();
        $mr = $this->match($u);
        // logIndex => gnubg loss (insanın kararları: 0,2,3). Rakip (1) verilmez -> wildbg kalır.
        app(ErrorJournalService::class)->analyzeMatch($mr, true, [0 => 0.200, 2 => 0.000, 3 => 0.300]);

        $d0 = DecisionAnalysis::where('match_result_id', $mr->id)->where('move_index', 0)->first();
        $this->assertNotNull($d0);
        $this->assertEqualsWithDelta(0.200, (float) $d0->equity_loss, 1e-6, 'insan kararı gnubg loss kullanmalı');
        $this->assertSame('gnubg', $d0->engine_version);

        // Rakip (black, index 1) gnubgLoss'ta yok -> wildbg loss (0.2) + engine wildbg.
        $dOpp = DecisionAnalysis::where('match_result_id', $mr->id)->where('is_opponent', true)->first();
        $this->assertSame('wildbg', $dOpp->engine_version);
    }

    // KULLANICI ŞİKÂYETİ: "Senin Hamlen 11/6 6/4 = En İyi Hamle 11/6 6/4" ama kayıp −0.034. Kayıp gnubg'den,
    // 'best' wildbg'den geliyordu. Tek motor gnubg: en iyi hamle + equity + adaylar da gnubg'den yazılır.
    public function test_gnubg_best_move_replaces_wildbg_suggestion(): void
    {
        $u = $this->user();
        $mr = $this->match($u);
        app(ErrorJournalService::class)->analyzeMatch($mr, true, [
            0 => ['loss' => 0.034, 'best' => '24/18 8/5', 'bestEquity' => 0.31, 'playedEquity' => 0.276,
                'cands' => [['notation' => '24/18 8/5', 'equity' => 0.31], ['notation' => '13/7 8/5', 'equity' => 0.276]]],
        ]);
        $d0 = DecisionAnalysis::where('match_result_id', $mr->id)->where('move_index', 0)->first();
        $this->assertSame('gnubg-best', $d0->engine_version);
        $this->assertSame('24/18 8/5', $d0->best); // wildbg'nin '24/18 13/10' önerisi DEĞİL
        $this->assertEqualsWithDelta(0.31, (float) $d0->best_equity, 1e-6);
        $this->assertEqualsWithDelta(0.276, (float) $d0->played_equity, 1e-6);

        $u->forceFill(['plan' => 'star', 'plan_until' => now()->addMonth()])->save();
        Sanctum::actingAs($u->fresh());
        $e = collect($this->getJson('/api/me/error-journal?period=all')->assertOk()->json('entries'))
            ->firstWhere('moveNumber', 0);
        $this->assertSame(['gnubg-best', '24/18 8/5', []], [$e['engine'], $e['bestMove'], $e['bestSteps']]);
        $this->assertSame('24/18 8/5', $e['alternatives'][0]['notation']);
        // Hatanın yapıldığı maç bilgisi (rakip/tür/sonuç) detayda gösterilir.
        $this->assertSame(['match', 5, true], [$e['match']['type'], $e['match']['length'], $e['match']['won']]);
        $this->assertArrayHasKey('opponent', $e['match']);
    }

    // Özet grafikleri: kategori blunder sayısı + gün gün hata oranı trendi (gerçek kararlardan).
    public function test_summary_has_category_blunders_and_daily_trend(): void
    {
        $u = $this->user();
        $svc = app(ErrorJournalService::class);
        $svc->analyzeMatch($this->match($u), true, $this->gnubgSame());
        \App\Models\DecisionAnalysis::where('user_id', $u->id)->where('move_index', 0)
            ->update(['played_at' => now()->subDays(2)]);
        $sum = $svc->summary($u, null, null);
        $this->assertSame(1, array_sum(array_column($sum['categories'], 'blunders')));
        $this->assertCount(2, $sum['trend']); // 2 farklı gün
        $this->assertSame([1, 1, 1], [$sum['trend'][0]['decisions'], $sum['trend'][0]['errors'], $sum['trend'][0]['blunders']]);
        $this->assertSame([2, 1, 0.5], [$sum['trend'][1]['decisions'], $sum['trend'][1]['errors'], $sum['trend'][1]['errorRate']]);
    }

    public function test_analyze_is_idempotent(): void
    {
        $u = $this->user();
        $mr = $this->match($u);
        $svc = app(ErrorJournalService::class);
        $svc->analyzeMatch($mr);
        $svc->analyzeMatch($mr, true); // force -> yeniden uret, duplicate YOK
        $this->assertSame(4, DecisionAnalysis::where('match_result_id', $mr->id)->count());
    }

    public function test_summary_counts_and_error_rate(): void
    {
        $u = $this->user();
        app(ErrorJournalService::class)->analyzeMatch($this->match($u), true, $this->gnubgSame());

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
        $u->plan = 'star'; // Hata Gunlugu PREMIUM-only (plan/plan_until fillable degil)
        $u->plan_until = now()->addYear();
        $u->save();
        app(ErrorJournalService::class)->analyzeMatch($this->match($u), true, $this->gnubgSame());
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

    public function test_endpoint_is_premium_only(): void
    {
        $u = $this->user(); // free plan
        app(ErrorJournalService::class)->analyzeMatch($this->match($u));
        Sanctum::actingAs($u);

        $this->getJson('/api/me/error-journal?period=all')
            ->assertStatus(403)
            ->assertJsonPath('code', 'premium_required');

        // /blunders goruntuleme de PREMIUM-only
        $this->getJson('/api/blunders')->assertStatus(403);
    }

    public function test_backfill_command(): void
    {
        $u = $this->user();
        $this->match($u); // analiz edilmemis
        $this->artisan('error-journal:backfill')->assertSuccessful();
        $this->assertSame(4, DecisionAnalysis::where('user_id', $u->id)->count()); // 3 sen + 1 rakip
    }
}
