<?php

namespace Tests\Feature;

use App\Models\DecisionAnalysis;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\DiceStatisticsService;
use App\Services\ErrorJournalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Zar Ortalamalari (dice averages): servis + endpoint + Hata Gunlugu izolasyonu.
class DiceStatsTest extends TestCase
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

    private function mr(User $u, bool $won): MatchResult
    {
        return MatchResult::create([
            'user_id' => $u->id, 'won' => $won,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'match_length' => 5, 'match_type' => 'match', 'pr' => 5.0,
        ]);
    }

    /** Bir karar analizi satiri. */
    private function da(
        User $u, MatchResult $mr, int $moveIndex, string $dice, bool $opponent,
        float $loss, string $cat = 'middle_game', int $pip = 100
    ): void {
        DecisionAnalysis::create([
            'user_id' => $u->id,
            'match_result_id' => $mr->id,
            'move_index' => $moveIndex,
            'played_at' => now(),
            'player' => $opponent ? 'black' : 'white',
            'is_opponent' => $opponent,
            'decision_type' => 'checker',
            'dice' => $dice,
            'equity_loss' => $loss,
            'severity' => $loss >= 0.02 ? 'mistake' : null,
            'primary_category' => $cat,
            'my_pip' => $pip,
            'analysis_version' => 2,
        ]);
    }

    // ==================== SERVIS ====================
    public function test_self_and_opponent_split_with_canonical_merge_and_winrate(): void
    {
        $u = $this->makeUser();
        $won = $this->mr($u, true);
        $lost = $this->mr($u, false);

        // SEN "6-3": kazanilan macta 0.02, "3-6" (kanonik ayni) 0.04, kaybedilen macta 0.06
        $this->da($u, $won, 0, '6-3', false, 0.02);
        $this->da($u, $won, 1, '3-6', false, 0.04); // kanonik -> 6-3'e katilir
        $this->da($u, $lost, 0, '6-3', false, 0.06);
        // RAKIP "5-5": iki macta da hatasiz
        $this->da($u, $won, 2, '5-5', true, 0.00, 'middle_game', 120);
        $this->da($u, $lost, 1, '5-5', true, 0.00, 'middle_game', 120);

        $stats = app(DiceStatisticsService::class)->diceStats($u, 'all');

        $this->assertSame('all', $stats['phase']);
        $this->assertSame(3, $stats['self']['sample']);
        $this->assertSame(2, $stats['opponent']['sample']);

        // SEN 6-3: n=3, avgError=(0.02+0.04+0.06)/3=0.04, winRate=2/3 kazanildi=66.7
        $selfRoll = collect($stats['self']['rolls'])->firstWhere('dice', '6-3');
        $this->assertNotNull($selfRoll);
        $this->assertSame(3, $selfRoll['n']);
        $this->assertSame(0.04, $selfRoll['avgError']);
        $this->assertSame(66.7, $selfRoll['winRate']);
        $this->assertSame(100, $selfRoll['avgPip']);
        // "3-6" ayri satir olarak DURMAMALI (kanonik birlestirildi)
        $this->assertNull(collect($stats['self']['rolls'])->firstWhere('dice', '3-6'));

        // RAKIP 5-5: winRate rakip perspektifi = 1 - (kullanici kazanma 0.5) = 50
        $oppRoll = collect($stats['opponent']['rolls'])->firstWhere('dice', '5-5');
        $this->assertNotNull($oppRoll);
        $this->assertSame(2, $oppRoll['n']);
        $this->assertSame(50.0, $oppRoll['winRate']);
        $this->assertSame(120, $oppRoll['avgPip']);
    }

    public function test_phase_filter_and_opening_win_rate(): void
    {
        $u = $this->makeUser();
        $won = $this->mr($u, true);

        $this->da($u, $won, 0, '3-1', false, 0.03, 'opening');
        $this->da($u, $won, 1, '4-2', false, 0.05, 'race');
        $this->da($u, $won, 2, '6-4', false, 0.02, 'middle_game'); // temas

        $svc = app(DiceStatisticsService::class);

        // opening: yalniz 3-1
        $op = $svc->diceStats($u, 'opening');
        $this->assertSame(1, $op['self']['sample']);
        $this->assertSame('3-1', $op['self']['rolls'][0]['dice']);
        // Acilis kazanma orani faz filtresinden bagimsiz: 1 acilis karari, mac kazanildi -> 100
        $this->assertSame(100.0, $op['self']['openingWinRate']);

        // race (Temas Yok): yalniz 4-2
        $race = $svc->diceStats($u, 'race');
        $this->assertSame(1, $race['self']['sample']);
        $this->assertSame('4-2', $race['self']['rolls'][0]['dice']);

        // contact (Temas): opening+race haric -> yalniz 6-4
        $contact = $svc->diceStats($u, 'contact');
        $this->assertSame(1, $contact['self']['sample']);
        $this->assertSame('6-4', $contact['self']['rolls'][0]['dice']);
    }

    public function test_invalid_phase_falls_back_to_all(): void
    {
        $u = $this->makeUser();
        $won = $this->mr($u, true);
        $this->da($u, $won, 0, '2-1', false, 0.01);

        $stats = app(DiceStatisticsService::class)->diceStats($u, 'garbage');
        $this->assertSame('all', $stats['phase']);
        $this->assertSame(1, $stats['self']['sample']);
    }

    // ==================== HATA GUNLUGU IZOLASYONU ====================
    public function test_error_journal_excludes_opponent_decisions(): void
    {
        $u = $this->makeUser();
        $won = $this->mr($u, true);
        // 1 kullanici hatasi + 1 rakip hatasi
        $this->da($u, $won, 0, '6-3', false, 0.10, 'middle_game');
        $this->da($u, $won, 1, '5-4', true, 0.10, 'middle_game');

        $summary = app(ErrorJournalService::class)->summary($u, null, null);
        // Yalniz kullanicinin karari sayilmali (rakip haric)
        $this->assertSame(1, $summary['decisionsAnalyzed']);
        $this->assertSame(1, $summary['totalErrors']);
    }

    // ==================== ENDPOINT ====================
    public function test_dice_stats_endpoint(): void
    {
        $u = $this->makeUser();
        $won = $this->mr($u, true);
        $this->da($u, $won, 0, '6-5', false, 0.03);
        $this->da($u, $won, 1, '2-2', true, 0.00);

        Sanctum::actingAs($u);
        $res = $this->getJson('/api/me/dice-stats?phase=all');
        $res->assertOk()
            ->assertJsonPath('phase', 'all')
            ->assertJsonPath('self.sample', 1)
            ->assertJsonPath('self.rolls.0.dice', '6-5')
            ->assertJsonPath('opponent.sample', 1);
    }

    public function test_endpoint_requires_auth(): void
    {
        $this->getJson('/api/me/dice-stats')->assertUnauthorized();
    }
}
