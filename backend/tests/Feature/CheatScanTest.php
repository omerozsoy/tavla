<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\CheatScan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Motor-yardımı dedektörü: mutlak + bimodal flag mantığı (bkz güvenlik incelemesi 2026-10-22).
 */
class CheatScanTest extends TestCase
{
    use RefreshDatabase;

    private function match(int $userId, float $pr, int $decisions): void
    {
        DB::table('match_results')->insert([
            'user_id' => $userId,
            'won' => 1,
            'opponent_rating' => 1500,
            'rating_before' => 1500,
            'rating_after' => 1510,
            'delta' => 10,
            'match_type' => 'match',
            'match_length' => 5,
            'gnubg_pr' => $pr,
            'gnubg_checker_pr' => $pr,
            'pr_decisions' => $decisions,
            'cube_decisions' => 2,
            'room_code' => 'R'.random_int(1000, 9999),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_long_sub3_match_is_flagged_absolute(): void
    {
        $u = User::factory()->create();
        $this->match($u->id, 0.70, 106); // uzun + motor-seviyesi

        $flags = CheatScan::flaggedMatches($u->id);
        $this->assertCount(1, $flags);
        $this->assertSame('mutlak', $flags[0]['reason']);
    }

    public function test_short_lowpr_match_is_ignored(): void
    {
        $u = User::factory()->create();
        $this->match($u->id, 0.01, 5); // kısa örneklem = gürültü, elenmeli

        $this->assertCount(0, CheatScan::flaggedMatches($u->id));
    }

    public function test_consistent_strong_player_is_clean(): void
    {
        $u = User::factory()->create();
        for ($i = 0; $i < 10; $i++) {
            $this->match($u->id, 7.0, 80); // tutarlı iyi-ama-insani, bimodal yok
        }

        $this->assertCount(0, CheatScan::flaggedMatches($u->id));
    }

    public function test_bimodal_match_below_own_median_is_flagged(): void
    {
        $u = User::factory()->create();
        for ($i = 0; $i < 8; $i++) {
            $this->match($u->id, 8.0, 50); // medyan ~8
        }
        $this->match($u->id, 2.8, 100); // 2.8 > mutlak eşik (2.0) ama medyanın çok altı -> bimodal

        $flags = CheatScan::flaggedMatches($u->id);
        $this->assertCount(1, $flags);
        $this->assertSame('bimodal', $flags[0]['reason']);
    }

    public function test_profile_verdict_consistent_when_median_below_world_champion(): void
    {
        // TÜM maçlar dünya-şampiyonu (2.5) seviyesinin altında -> medyan düşük -> SÜREKLİ motor.
        $u = User::factory()->create();
        foreach ([1.2, 1.8, 2.1, 1.5, 2.3, 1.9, 2.0, 1.6, 2.2, 1.7] as $pr) {
            $this->match($u->id, $pr, 90);
        }
        $pf = CheatScan::profile($u->id);
        $this->assertSame('consistent', $pf['verdict']);
        $this->assertSame(10, $pf['n']);
        $this->assertLessThan(CheatScan::PR_WORLD_CHAMPION, $pf['median']);
        $this->assertSame(10, $pf['below_wc']); // hepsi şampiyon çizgisinin altında
    }

    public function test_profile_verdict_selective_when_normal_median_with_engine_dips(): void
    {
        // Medyan normal (~8) AMA birkaç maç motor-eşiğinin altında -> SEÇİCİ (iki-tepeli).
        $u = User::factory()->create();
        for ($i = 0; $i < 8; $i++) {
            $this->match($u->id, 8.0, 80);
        }
        $this->match($u->id, 0.5, 100);
        $this->match($u->id, 1.1, 95);
        $pf = CheatScan::profile($u->id);
        $this->assertSame('selective', $pf['verdict']);
        $this->assertSame(2, $pf['below_engine']);
        $this->assertGreaterThan(CheatScan::PR_WORLD_CHAMPION, $pf['median']);
    }

    public function test_suspects_lists_flagged_user(): void
    {
        $cheat = User::factory()->create(['nickname' => 'Suspect']);
        $clean = User::factory()->create();
        $this->match($cheat->id, 0.8, 90); // suspect için ≥2 uzun-düşük maç (tek maç = varyans, elenir)
        $this->match($cheat->id, 1.2, 110);
        for ($i = 0; $i < 5; $i++) {
            $this->match($clean->id, 9.0, 60);
        }

        $suspects = CheatScan::suspects();
        $this->assertCount(1, $suspects);
        $this->assertSame($cheat->id, $suspects[0]['user_id']);
    }
}
