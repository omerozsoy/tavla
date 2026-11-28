<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Setting;
use App\Models\User;
use App\Services\CareerPrService;
use App\Support\RankDivisions;
use App\Support\RankService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** RankService: efektif rütbe (rating+PR+EP) enforcement'ı + toggle + provisional. */
class RankServiceTest extends TestCase
{
    use RefreshDatabase;

    private int $room = 0;

    private function user(int $rating): User
    {
        $u = User::create([
            'first_name' => 'r', 'last_name' => 'T', 'country' => '',
            'nickname' => 'u'.(++$this->room), 'email' => 'u'.$this->room.'@e.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(['rating' => $rating])->save(); // 'rating' $fillable değil

        return $u->refresh();
    }

    private function mr(User $u, float $pr, int $len): void
    {
        $mr = MatchResult::create([
            'user_id' => $u->id, 'won' => true,
            'opponent_rating' => 1500, 'rating_before' => $u->rating, 'rating_after' => $u->rating, 'delta' => 0,
            'match_length' => $len, 'match_type' => 'match', 'pr' => $pr,
            'room_code' => 'R'.$u->id.'_'.(++$this->room),
            'pr_equity_lost' => $pr * 100 / CareerPrService::SCALE, 'pr_decisions' => 100, 'rated' => true,
        ]);
        $mr->forceFill(['gnubg_pr' => $pr])->save();
    }

    // Toggle KAPALI -> null (frontend rating'e düşer, sıfır değişiklik).
    public function test_inactive_returns_null(): void
    {
        Setting::put('rank_system_active', '0');
        $u = $this->user(2240);
        $this->mr($u, 5.2, 9);
        $this->assertNull(RankService::effectiveDivKey($u));
    }

    // AÇIK + rating 2240 / PR 5.2 / EP 540 -> Master M2 (PR 5.2 > M1 4.75, G3 4.0 -> kapalı).
    public function test_active_three_criteria_caps_to_master_m2(): void
    {
        Setting::put('rank_system_active', '1');
        $u = $this->user(2240);
        for ($i = 0; $i < 60; $i++) {
            $this->mr($u, 5.2, 9); // 60×9 = 540 EP, PR 5.2
        }
        $this->assertSame('div.m2', RankService::effectiveDivKey($u));
    }

    // AÇIK ama PR verisi YOK -> provisional: rating rütbesi (2240 -> g2).
    public function test_provisional_falls_back_to_rating_rank(): void
    {
        Setting::put('rank_system_active', '1');
        $u = $this->user(2240); // analizli maç yok
        $this->assertSame('div.g2', RankService::effectiveDivKey($u));
    }

    // /api/ranks: AÇIKken id->rank_key haritası; KAPALIyken boş (rozet rating'e düşer).
    public function test_ranks_endpoint_gated_by_toggle(): void
    {
        $u = $this->user(2240);
        $u->forceFill(['rank_key' => 'div.m2'])->save();

        Setting::put('rank_system_active', '1');
        $this->getJson('/api/ranks?ids='.$u->id)
            ->assertOk()
            ->assertJsonPath('ranks.'.$u->id, 'div.m2');

        Setting::put('rank_system_active', '0');
        $this->getJson('/api/ranks?ids='.$u->id)
            ->assertOk()
            ->assertDontSee('div.m2');
    }

    // Ünvan sıralaması: efektif rütbeye göre (GM > Advanced). KAPALIyken boş.
    public function test_rank_leaderboard_sorted_by_tier(): void
    {
        $gm = $this->user(2240);
        $gm->forceFill(['rank_key' => 'div.g2', 'is_system' => false])->save();
        $adv = $this->user(1850);
        $adv->forceFill(['rank_key' => 'div.a3', 'is_system' => false])->save();

        Setting::put('rank_system_active', '0');
        $this->getJson('/api/leaderboard/rank')->assertOk()->assertJsonPath('players', []);

        Setting::put('rank_system_active', '1');
        $players = $this->getJson('/api/leaderboard/rank')->assertOk()->json('players');
        $this->assertCount(2, $players);
        $this->assertSame('div.g2', $players[0]['rank_key']); // güçlü rütbe önce
        $this->assertSame('div.a3', $players[1]['rank_key']);
    }

    // Önizleme: önbellekten (rank_window_pr/rank_ep) dağılım + düşer/yükselir sayar.
    public function test_preview_distribution(): void
    {
        $u1 = $this->user(2240);
        $u1->forceFill(['rank_window_pr' => 5.2, 'rank_ep' => 540, 'rank_key' => 'div.m2', 'is_system' => false])->save();
        $u2 = $this->user(2240);
        $u2->forceFill(['rank_window_pr' => 5.2, 'rank_ep' => 540, 'rank_key' => 'div.m2', 'is_system' => false])->save();

        // Mevcut eşiklerle: ikisi de m2, değişmez.
        $res = RankService::previewDistribution(RankDivisions::thresholds(), RankDivisions::prThresholds(), RankDivisions::epThresholds());
        $this->assertSame(2, $res['counts']['div.m2']);
        $this->assertSame(2, $res['same']);

        // m2 PR'ını 5.5->5.0 sıkılaştır: PR 5.2 artık m2 değil -> m3'e DÜŞER.
        $pr = RankDivisions::prThresholds();
        $pr['div.m2'] = 5.0;
        $res2 = RankService::previewDistribution(RankDivisions::thresholds(), $pr, RankDivisions::epThresholds());
        $this->assertSame(2, $res2['counts']['div.m3']);
        $this->assertSame(2, $res2['down']);
    }

    // refresh() rank_key önbelleğini yazar.
    public function test_refresh_writes_rank_key(): void
    {
        Setting::put('rank_system_active', '1');
        $u = $this->user(2240);
        for ($i = 0; $i < 60; $i++) {
            $this->mr($u, 5.2, 9);
        }
        RankService::refresh($u);
        $this->assertSame('div.m2', $u->fresh()->rank_key);

        // Toggle kapanınca refresh null yapar.
        Setting::put('rank_system_active', '0');
        RankService::refresh($u);
        $this->assertNull($u->fresh()->rank_key);
    }
}
