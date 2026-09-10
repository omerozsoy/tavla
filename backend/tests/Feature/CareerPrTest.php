<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Setting;
use App\Models\User;
use App\Services\CareerPrService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Career PR (PR Sıralaması): havuzlanmis PR = (Σ pr_equity_lost / Σ pr_decisions) × 500.
 * Maç PR'larinin ortalamasi DEGILDIR; karar-agirliklidir.
 */
class CareerPrTest extends TestCase
{
    use RefreshDatabase;

    private int $room = 0;

    protected function setUp(): void
    {
        parent::setUp();
        // Testler 500 karar / 10 maç esigine gore yazildi; varsayilan degisse de sabitle.
        Setting::put('pr_min_matches', 10);
        Setting::put('pr_min_decisions', 500);
    }

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com', 'password' => bcrypt('secret123'),
        ]);
    }

    /** PR=$pr, karar=$dec olan bir GERÇEK (online) maç. equity_lost = pr*dec/500. */
    private function mr(User $u, float $pr, int $dec, array $over = []): MatchResult
    {
        $loss = $pr * $dec / CareerPrService::SCALE;

        return MatchResult::create(array_merge([
            'user_id' => $u->id, 'won' => true,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'match_length' => 5, 'match_type' => 'match', 'pr' => round($pr, 2),
            'room_code' => 'R'.(++$this->room), // insan/online maç (bot degil)
            'pr_equity_lost' => $loss, 'pr_decisions' => $dec,
        ], $over));
    }

    private function svc(): CareerPrService
    {
        return app(CareerPrService::class);
    }

    // TEST 1: agirlikli havuzlama. (2×100 + 8×20)/120 = 3.00 (basit ortalama 5.00 DEGIL).
    public function test_weighted_pooling_not_simple_average(): void
    {
        $u = $this->user('a');
        $this->mr($u, 2.0, 100);
        $this->mr($u, 8.0, 20);
        $this->svc()->recalc($u->refresh());

        $this->assertEqualsWithDelta(3.00, $u->fresh()->career_pr, 0.0001);
        $this->assertNotEquals(5.00, round($u->fresh()->career_pr, 2));
        $this->assertSame(2, $u->fresh()->career_pr_matches);
        $this->assertSame(120, $u->fresh()->career_pr_decisions);
    }

    // TEST 2: 10 maç ama 400 karar -> leaderboard'a GIREMEZ.
    public function test_10_matches_400_decisions_not_eligible(): void
    {
        $u = $this->user('b');
        for ($i = 0; $i < 10; $i++) {
            $this->mr($u, 3.0, 40); // 10×40 = 400 < 500
        }
        $this->svc()->recalc($u->refresh());
        $this->assertNotContainsUser($u);
    }

    // TEST 3: 8 maç ve 1000 karar -> GIREMEZ (maç sarti saglanmadi).
    public function test_8_matches_1000_decisions_not_eligible(): void
    {
        $u = $this->user('c');
        for ($i = 0; $i < 8; $i++) {
            $this->mr($u, 3.0, 125); // 8×125 = 1000 ama 8 < 10
        }
        $this->svc()->recalc($u->refresh());
        $this->assertNotContainsUser($u);
    }

    // TEST 4: 10 maç + 500 karar -> GIRER.
    public function test_10_matches_500_decisions_eligible(): void
    {
        $u = $this->user('d');
        for ($i = 0; $i < 10; $i++) {
            $this->mr($u, 3.0, 50); // 10×50 = 500
        }
        $this->svc()->recalc($u->refresh());
        $this->assertContainsUser($u);
    }

    // TEST 5: dusuk PR ust sirada.
    public function test_lower_pr_ranks_first(): void
    {
        foreach (['e' => 4.0, 'f' => 2.1, 'g' => 3.0, 'h' => 2.5] as $nick => $pr) {
            $u = $this->user($nick);
            for ($i = 0; $i < 10; $i++) {
                $this->mr($u, $pr, 60);
            }
            $this->svc()->recalc($u->refresh());
        }
        $prs = collect($this->prBoard()['players'])->pluck('career_pr')->map(fn ($x) => round($x, 2))->all();
        $this->assertSame([2.1, 2.5, 3.0, 4.0], $prs);
    }

    // TEST 6: tam hassasiyet siralama (UI ikisini 2.18 gosterse de 2.181 ustte).
    public function test_full_precision_tiebreak_by_true_pr(): void
    {
        $a = $this->user('pa');
        $b = $this->user('pb');
        // career_pr = loss/dec*500. dec=1000 sabit: pr = loss*0.5.
        for ($i = 0; $i < 10; $i++) {
            $this->mr($a, 0, 100, ['pr_equity_lost' => 0.43620, 'pr_decisions' => 100]); // toplam 4.362/1000 -> 2.181
            $this->mr($b, 0, 100, ['pr_equity_lost' => 0.43680, 'pr_decisions' => 100]); // 2.184
        }
        $this->svc()->recalc($a->refresh());
        $this->svc()->recalc($b->refresh());
        $this->assertEqualsWithDelta(2.181, $a->fresh()->career_pr, 0.0005);
        $this->assertEqualsWithDelta(2.184, $b->fresh()->career_pr, 0.0005);
        // UI 2dp esit gorunur ama siralamada A once.
        $this->assertSame(round($a->fresh()->career_pr, 2), round($b->fresh()->career_pr, 2));
        $players = $this->prBoard()['players'];
        $ids = collect($players)->pluck('id')->all();
        $this->assertTrue(array_search($a->id, $ids) < array_search($b->id, $ids));
    }

    // TEST 7: eksik/failed analiz (pr_decisions null) Career PR'yi ETKILEMEZ.
    public function test_failed_analysis_excluded(): void
    {
        $u = $this->user('i');
        $this->mr($u, 2.0, 100);
        // Analizi olmayan maç (null totaller) + AI maç + bot maç (room_code null) -> HARIÇ.
        MatchResult::create(['user_id' => $u->id, 'won' => false, 'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0, 'match_length' => 5, 'match_type' => 'match', 'room_code' => 'Rx', 'pr_equity_lost' => null, 'pr_decisions' => null]);
        $this->mr($u, 99.0, 100, ['match_type' => 'ai']);
        $this->mr($u, 99.0, 100, ['room_code' => null]);
        $this->svc()->recalc($u->refresh());

        $this->assertSame(1, $u->fresh()->career_pr_matches);
        $this->assertSame(100, $u->fresh()->career_pr_decisions);
        $this->assertEqualsWithDelta(2.00, $u->fresh()->career_pr, 0.0001);
    }

    // TEST 8: yeni analiz tamamlaninca Career PR guncellenir.
    public function test_recalc_reflects_new_match(): void
    {
        $u = $this->user('j');
        $this->mr($u, 2.0, 100);
        $this->svc()->recalc($u->refresh());
        $this->assertEqualsWithDelta(2.00, $u->fresh()->career_pr, 0.0001);

        $this->mr($u, 8.0, 20);
        $this->svc()->recalc($u->refresh());
        $this->assertEqualsWithDelta(3.00, $u->fresh()->career_pr, 0.0001);
    }

    // TEST 9: bir maç silinince aggregate bozulmaz (recalc yeniden hesaplar).
    public function test_recalc_after_delete(): void
    {
        $u = $this->user('k');
        $this->mr($u, 2.0, 100);
        $bad = $this->mr($u, 8.0, 20);
        $this->svc()->recalc($u->refresh());
        $this->assertEqualsWithDelta(3.00, $u->fresh()->career_pr, 0.0001);

        $bad->delete();
        $this->svc()->recalc($u->refresh());
        $this->assertEqualsWithDelta(2.00, $u->fresh()->career_pr, 0.0001);
        $this->assertSame(100, $u->fresh()->career_pr_decisions);
    }

    // TEST 10: recalc idempotent (ikinci cagri ayni sonuc).
    public function test_recalc_idempotent(): void
    {
        $u = $this->user('l');
        $this->mr($u, 2.0, 100);
        $this->mr($u, 8.0, 20);
        $this->svc()->recalc($u->refresh());
        $first = $u->fresh()->career_pr;
        $this->svc()->recalc($u->refresh());
        $this->assertSame($first, $u->fresh()->career_pr);
        $this->assertSame(120, $u->fresh()->career_pr_decisions);
    }

    // ---- yardimcilar ----
    private function prBoard(): array
    {
        return $this->getJson('/api/leaderboard/pr?limit=100')->assertOk()->json();
    }

    private function assertContainsUser(User $u): void
    {
        $ids = collect($this->prBoard()['players'])->pluck('id')->all();
        $this->assertContains($u->id, $ids);
    }

    private function assertNotContainsUser(User $u): void
    {
        $ids = collect($this->prBoard()['players'])->pluck('id')->all();
        $this->assertNotContains($u->id, $ids);
    }
}
