<?php

namespace Tests\Feature;

use App\Models\DecisionAnalysis;
use App\Models\MatchResult;
use App\Models\User;
use App\Models\UserWxpTransaction;
use App\Services\MedianPerformanceService;
use App\Services\WxpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Medyan Hata Orani + WXP: uctan uca (servis + endpoint + backfill).
class PerformanceStatsTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick = 'p1'): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    /** match_results satiri olustur (opsiyonel created_at gecmisi). */
    private function mr(User $u, bool $won, ?int $length, string $type, ?float $pr, int $daysAgo = 0, ?float $oppPr = null): MatchResult
    {
        $mr = MatchResult::create([
            'user_id' => $u->id, 'won' => $won,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'match_length' => $length, 'match_type' => $type, 'pr' => $pr, 'opponent_pr' => $oppPr,
        ]);
        if ($daysAgo > 0) {
            $mr->created_at = now()->subDays($daysAgo);
            $mr->saveQuietly();
        }

        return $mr;
    }

    /** Bir maca per-karar analiz satiri ekle (equity_loss = per-karar hata). */
    private function da(User $u, MatchResult $mr, int $moveIndex, float $loss, bool $opponent = false, int $daysAgo = 0): void
    {
        DecisionAnalysis::create([
            'user_id' => $u->id,
            'match_result_id' => $mr->id,
            'move_index' => $moveIndex,
            'played_at' => now()->subDays($daysAgo),
            'player' => $opponent ? 'black' : 'white',
            'is_opponent' => $opponent,
            'decision_type' => 'checker',
            'dice' => '6-3',
            'equity_loss' => $loss,
            'severity' => $loss >= 0.02 ? 'mistake' : null,
            'primary_category' => 'middle_game',
            'analysis_version' => 2,
        ]);
    }

    // ==================== MEDIAN ====================
    public function test_categories_are_independent_and_use_real_median(): void
    {
        $u = $this->makeUser();
        // 5S: [4.20,5.10,7.30,8.40,15.90] -> median 7.30
        foreach ([4.20, 5.10, 7.30, 8.40, 15.90] as $pr) {
            $this->mr($u, true, 5, 'match', $pr);
        }
        // 1S: [6.00,7.00] -> 6.50
        $this->mr($u, true, 1, 'match', 6.00);
        $this->mr($u, false, 1, 'match', 7.00);
        // 3S: tek deger 13.09
        $this->mr($u, true, 3, 'match', 13.09);

        $svc = app(MedianPerformanceService::class);
        $cats = $svc->categoriesFor($u->id, 'all');

        $this->assertSame(7.30, $cats['5']['median_pr']);
        $this->assertSame(5, $cats['5']['sample_count']);
        $this->assertSame(6.50, $cats['1']['median_pr']);
        $this->assertSame(2, $cats['1']['sample_count']);
        $this->assertSame(13.09, $cats['3']['median_pr']);
        $this->assertSame(1, $cats['3']['sample_count']);
        // Veri yok -> null (0.00 DEGIL)
        $this->assertNull($cats['7']['median_pr']);
        $this->assertSame(0, $cats['7']['sample_count']);
        $this->assertNull($cats['coin']['median_pr']);
    }

    public function test_coin_and_one_point_match_are_separate_categories(): void
    {
        $u = $this->makeUser();
        // Jeton (coin) 3 mac -> median
        $this->mr($u, true, 1, 'coin', 17.50);
        $this->mr($u, true, 1, 'coin', 20.00);
        $this->mr($u, true, 1, 'coin', 15.00);
        // 1S (match) 1 mac
        $this->mr($u, true, 1, 'match', 6.38);

        $cats = app(MedianPerformanceService::class)->categoriesFor($u->id, 'all');
        $this->assertSame(17.50, $cats['coin']['median_pr']); // ortadaki: 15,17.5,20 -> 17.5
        $this->assertSame(3, $cats['coin']['sample_count']);
        $this->assertSame(6.38, $cats['1']['median_pr']);
        $this->assertSame(1, $cats['1']['sample_count']); // coin karismadi
    }

    public function test_opponent_pr_not_mixed_into_user(): void
    {
        $u = $this->makeUser('me');
        $opp = $this->makeUser('opp');
        // Kendi 5S PR=10, rakibin pr'i (opponent_pr) 99 -> median 10 olmali
        $this->mr($u, true, 5, 'match', 10.00, 0, 99.0);
        // Rakibin kendi satiri (baska user) -> u'nun medianina girmemeli
        $this->mr($opp, false, 5, 'match', 99.00);

        $cats = app(MedianPerformanceService::class)->categoriesFor($u->id, 'all');
        $this->assertSame(10.00, $cats['5']['median_pr']);
        $this->assertSame(1, $cats['5']['sample_count']);
    }

    public function test_null_pr_rows_excluded_from_median(): void
    {
        $u = $this->makeUser();
        $this->mr($u, true, 5, 'match', 10.00);
        $this->mr($u, true, 5, 'match', null); // analiz yok -> haric
        $cats = app(MedianPerformanceService::class)->categoriesFor($u->id, 'all');
        $this->assertSame(10.00, $cats['5']['median_pr']);
        $this->assertSame(1, $cats['5']['sample_count']);
    }

    public function test_date_filters(): void
    {
        $u = $this->makeUser();
        $this->mr($u, true, 5, 'match', 5.00, 2);    // 2 gun once
        $this->mr($u, true, 5, 'match', 9.00, 20);   // 20 gun once
        $this->mr($u, true, 5, 'match', 15.00, 200); // 200 gun once
        $svc = app(MedianPerformanceService::class);

        $this->assertSame(1, $svc->categoriesFor($u->id, '7d')['5']['sample_count']);   // sadece 2g
        $this->assertSame(2, $svc->categoriesFor($u->id, '30d')['5']['sample_count']);  // 2g+20g
        $this->assertSame(2, $svc->categoriesFor($u->id, '90d')['5']['sample_count']);  // 2g+20g
        $this->assertSame(3, $svc->categoriesFor($u->id, '1y')['5']['sample_count']);   // 200g <365
        $this->assertSame(3, $svc->categoriesFor($u->id, 'all')['5']['sample_count']);
    }

    // ==================== WXP ====================
    public function test_wxp_award_amounts(): void
    {
        $u = $this->makeUser();
        $wxp = app(WxpService::class);
        $wxp->awardForMatchResult($this->mr($u, true, 1, 'coin', null)); // +1
        $wxp->awardForMatchResult($this->mr($u, true, 1, 'match', null)); // +1
        $wxp->awardForMatchResult($this->mr($u, true, 3, 'match', null)); // +3
        $wxp->awardForMatchResult($this->mr($u, true, 5, 'match', null)); // +5
        $wxp->awardForMatchResult($this->mr($u, true, 7, 'match', null)); // +7
        $wxp->awardForMatchResult($this->mr($u, false, 7, 'match', null)); // kayip -> 0

        $this->assertSame(17, (int) $u->fresh()->total_wxp); // 1+1+3+5+7
        $this->assertSame(17, $wxp->totalFromLedger($u->id));
        $this->assertSame(5, UserWxpTransaction::where('user_id', $u->id)->count()); // kayip tx yok
    }

    public function test_wxp_is_idempotent_no_double_credit(): void
    {
        $u = $this->makeUser();
        $wxp = app(WxpService::class);
        $mr = $this->mr($u, true, 7, 'match', null);

        $wxp->awardForMatchResult($mr);
        $wxp->awardForMatchResult($mr); // ayni mac tekrar -> duplicate YOK
        $wxp->awardForMatchResult($mr);

        $this->assertSame(7, (int) $u->fresh()->total_wxp);
        $this->assertSame(1, UserWxpTransaction::where('match_result_id', $mr->id)->count());
    }

    public function test_ledger_sum_equals_cached_total(): void
    {
        $u = $this->makeUser();
        $wxp = app(WxpService::class);
        foreach ([1, 3, 5, 7] as $len) {
            $wxp->awardForMatchResult($this->mr($u, true, $len, 'match', null));
        }
        $this->assertSame($wxp->totalFromLedger($u->id), (int) $u->fresh()->total_wxp);
    }

    public function test_wxp_unaffected_by_rating_or_length_extras(): void
    {
        // WXP yalniz tur/uzunluga bagli; opponent_rating/pr farkli olsa da 7S = 7.
        $u = $this->makeUser();
        $mr = MatchResult::create([
            'user_id' => $u->id, 'won' => true, 'opponent_rating' => 3000,
            'rating_before' => 1000, 'rating_after' => 1050, 'delta' => 50,
            'match_length' => 7, 'match_type' => 'match', 'pr' => 2.1, 'opponent_pr' => 1.0,
        ]);
        app(WxpService::class)->awardForMatchResult($mr);
        $this->assertSame(7, (int) $u->fresh()->total_wxp);
    }

    // ==================== ENDPOINT ====================
    public function test_performance_stats_endpoint(): void
    {
        $u = $this->makeUser();
        $wxp = app(WxpService::class);
        // 2 galibiyet (WXP 1+7=8) + 1 maglubiyet -> win_rate 66.67 (kesirli; JSON int/float belirsizligi yok)
        $m1 = $this->mr($u, true, 1, 'match', 6.38);
        $wxp->awardForMatchResult($m1);
        $m7 = $this->mr($u, true, 7, 'match', 16.47);
        $wxp->awardForMatchResult($m7);
        $m5 = $this->mr($u, false, 5, 'match', 15.93);

        // Medyan artik PER-KARAR (decision_analyses.equity_loss * 500). Ayni beklenen
        // degerleri uretecek per-karar hatalar:
        $this->da($u, $m1, 0, 0.01276);            // *500 = 6.38 (tek karar -> medyan 6.38)
        $this->da($u, $m7, 0, 0.03294);            // *500 = 16.47
        $this->da($u, $m5, 0, 0.03);               // *500 = 15.0  \ cift karar medyani
        $this->da($u, $m5, 1, 0.03372);            // *500 = 16.86 / -> (15.0+16.86)/2 = 15.93
        $this->da($u, $m5, 2, 0.90, opponent: true); // RAKIP karari -> medyana GIRMEZ

        Sanctum::actingAs($u->fresh()); // cached total_wxp DB'de guncellendi -> taze oku
        $res = $this->getJson('/api/me/performance-stats?period=all');
        $res->assertOk()
            ->assertJsonPath('median_error_rate.filter', 'all')
            ->assertJsonPath('median_error_rate.categories.1.median_pr', 6.38)
            ->assertJsonPath('median_error_rate.categories.1.sample_count', 1)
            ->assertJsonPath('median_error_rate.categories.7.median_pr', 16.47)
            ->assertJsonPath('median_error_rate.categories.5.median_pr', 15.93)
            ->assertJsonPath('median_error_rate.categories.5.sample_count', 2) // rakip haric
            ->assertJsonPath('median_error_rate.categories.3.median_pr', null)
            ->assertJsonPath('median_error_rate.categories.coin.median_pr', null)
            ->assertJsonPath('wxp.total', 8)
            ->assertJsonPath('wxp.wins', 2)
            ->assertJsonPath('wxp.losses', 1)
            ->assertJsonPath('wxp.total_matches', 3)
            ->assertJsonPath('wxp.win_rate', 66.67);
    }

    // XG §13: lifetime PR HAVUZLANIR (maç PR ortalamasi DEGIL). Cok-kararli maç agir basar.
    public function test_pooled_pr_pools_raw_totals_not_match_average(): void
    {
        $u = $this->makeUser();
        // Ayni kategori (7S). MaçA: 10 karar, loss 0.04 -> PR 2. MaçB: 100 karar, loss 2.0 -> PR 10.
        $a = $this->mr($u, true, 7, 'match', 2.0);
        $a->pr_equity_lost = 0.04;
        $a->pr_decisions = 10;
        $a->saveQuietly();
        $b = $this->mr($u, false, 7, 'match', 10.0);
        $b->pr_equity_lost = 2.0;
        $b->pr_decisions = 100;
        $b->saveQuietly();

        Sanctum::actingAs($u->fresh());
        $res = $this->getJson('/api/me/performance-stats?period=all');
        // Havuzlanmis: (0.04+2.0)/(10+100)*500 = 9.27... (ORTALAMA (2+10)/2=6 DEGIL)
        $res->assertOk()
            ->assertJsonPath('pooled_pr.categories.7.pooled_pr', 9.27)
            ->assertJsonPath('pooled_pr.categories.7.decisions', 110)
            ->assertJsonPath('pooled_pr.categories.coin.pooled_pr', null);
    }

    // Per-karar medyan: kategori bagimsizligi + rakip/forced haric + tarih filtresi.
    public function test_per_decision_median_source_and_filters(): void
    {
        $u = $this->makeUser();
        $svc = app(MedianPerformanceService::class);

        // 5S maci: 3 kendi karari [0.02,0.04,0.06]*500 = [10,20,30] -> medyan 20
        $m5 = $this->mr($u, true, 5, 'match', null);
        $this->da($u, $m5, 0, 0.02);
        $this->da($u, $m5, 1, 0.04);
        $this->da($u, $m5, 2, 0.06);
        $this->da($u, $m5, 3, 0.99, opponent: true); // rakip -> haric

        // 1S maci (eski): tarih filtresi disinda kalmali
        $mOld = $this->mr($u, true, 1, 'match', null, 200);
        $this->da($u, $mOld, 0, 0.02, false, 200);

        $all = $svc->perDecisionCategoriesFor($u->id, 'all');
        $this->assertSame(20.0, $all['5']['median_pr']);
        $this->assertSame(3, $all['5']['sample_count']);   // rakip karisMADI
        $this->assertSame(1, $all['1']['sample_count']);
        $this->assertNull($all['3']['median_pr']);         // veri yok -> null

        // 7 gun: eski 1S karari duser, 5S kalir
        $recent = $svc->perDecisionCategoriesFor($u->id, '7d');
        $this->assertSame(3, $recent['5']['sample_count']);
        $this->assertSame(0, $recent['1']['sample_count']);
    }

    public function test_endpoint_requires_auth(): void
    {
        $this->getJson('/api/me/performance-stats')->assertUnauthorized();
    }

    // ==================== BACKFILL ====================
    public function test_backfill_is_correct_and_idempotent(): void
    {
        $u = $this->makeUser();
        // Ledger'a dokunmadan gecmis maclar olustur (award CAGIRMADAN)
        $this->mr($u, true, 1, 'coin', null);
        $this->mr($u, true, 3, 'match', null);
        $this->mr($u, true, 7, 'match', null);
        $this->mr($u, false, 5, 'match', null); // kayip -> WXP yok

        $this->artisan('stats:backfill-wxp')->assertSuccessful();
        $this->assertSame(11, (int) $u->fresh()->total_wxp); // 1+3+7
        $this->assertSame(3, UserWxpTransaction::where('user_id', $u->id)->count());

        // Ikinci kez -> duplicate YOK
        $this->artisan('stats:backfill-wxp')->assertSuccessful();
        $this->assertSame(11, (int) $u->fresh()->total_wxp);
        $this->assertSame(3, UserWxpTransaction::where('user_id', $u->id)->count());
    }

    public function test_backfill_dry_run_writes_nothing(): void
    {
        $u = $this->makeUser();
        $this->mr($u, true, 7, 'match', null);
        $this->artisan('stats:backfill-wxp --dry-run')->assertSuccessful();
        $this->assertSame(0, UserWxpTransaction::count());
        $this->assertSame(0, (int) $u->fresh()->total_wxp);
    }

    public function test_rebuild_totals_from_ledger(): void
    {
        $u = $this->makeUser();
        app(WxpService::class)->awardForMatchResult($this->mr($u, true, 7, 'match', null));
        // Cached total'i boz -> rebuild ledger'dan duzeltmeli
        $u->total_wxp = 999;
        $u->saveQuietly();
        $this->artisan('stats:backfill-wxp --rebuild-totals')->assertSuccessful();
        $this->assertSame(7, (int) $u->fresh()->total_wxp);
    }
}
