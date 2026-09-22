<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * /api/top-ranks — site geneli top-3 rozet haritasi. PR sIralamasInda ilk 3 (madalya)
 * + Rating sIralamasInda ilk 3 (kupa) oyuncunun id+rank'i. Siralama kriterleri
 * leaderboard/prLeaderboard ile AYNI olmali.
 */
class TopRanksTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush(); // endpoint 120s cache'ler -> testler arasi bayat kalmasin
        Setting::put('pr_min_matches', 1);
        Setting::put('pr_min_decisions', 1);
    }

    private function user(string $nick, int $rating, ?float $pr = null): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com', 'password' => bcrypt('secret123'),
        ]);
        $u->forceFill([
            'rating' => $rating,
            'career_pr' => $pr,
            'career_pr_matches' => $pr !== null ? 5 : 0,
            'career_pr_decisions' => $pr !== null ? 200 : 0,
            'career_pr_equity_lost' => $pr !== null ? $pr * 200 / 500 : 0,
        ])->save();

        return $u;
    }

    public function test_rating_top3_matches_leaderboard_order(): void
    {
        $a = $this->user('a', 2000);
        $b = $this->user('b', 1900);
        $c = $this->user('c', 1500);
        $this->user('d', 1400); // 4. -> disarida

        $data = $this->getJson('/api/top-ranks')->assertOk()->json();

        $this->assertSame(
            [['id' => $a->id, 'rank' => 1], ['id' => $b->id, 'rank' => 2], ['id' => $c->id, 'rank' => 3]],
            $data['rating'],
        );
    }

    public function test_pr_top3_lower_pr_first(): void
    {
        $a = $this->user('pa', 1500, 2.0); // en iyi (dusuk PR)
        $b = $this->user('pb', 1500, 3.0);
        $c = $this->user('pc', 1500, 4.0);
        $this->user('pd', 1500, 5.0);      // 4. -> disarida
        $this->user('pe', 1500, null);     // PR yok -> hic girmez

        $data = $this->getJson('/api/top-ranks')->assertOk()->json();

        $this->assertSame(
            [['id' => $a->id, 'rank' => 1], ['id' => $b->id, 'rank' => 2], ['id' => $c->id, 'rank' => 3]],
            $data['pr'],
        );
    }

    public function test_same_user_can_top_both_lists(): void
    {
        $a = $this->user('x', 2000, 2.0); // hem rating 1. hem PR 1.
        $this->user('y', 1000, 9.0);

        $data = $this->getJson('/api/top-ranks')->assertOk()->json();

        $this->assertSame($a->id, $data['rating'][0]['id']);
        $this->assertSame(1, $data['rating'][0]['rank']);
        $this->assertSame($a->id, $data['pr'][0]['id']);
        $this->assertSame(1, $data['pr'][0]['rank']);
    }
}
