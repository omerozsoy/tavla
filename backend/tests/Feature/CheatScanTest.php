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

    public function test_bot_match_is_excluded(): void
    {
        // PvB (bot) odasında eğitim/ipucu modu olabilir → düşük PR meşru, flag'lenMEMELİ.
        $u = User::factory()->create();
        DB::table('rooms')->insert(['code' => 'BOT1', 'p1_token' => 'a', 'p1_name' => 'W', 'bot' => true]);
        DB::table('match_results')->insert([
            'user_id' => $u->id, 'won' => 1, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1510, 'delta' => 10,
            'match_type' => 'match', 'match_length' => 5, 'gnubg_pr' => 0.70,
            'gnubg_checker_pr' => 0.70, 'pr_decisions' => 106, 'cube_decisions' => 2,
            'room_code' => 'BOT1', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertCount(0, CheatScan::flaggedMatches($u->id));
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

    public function test_move_match_computes_engine_top_move_rate(): void
    {
        $white = User::factory()->create();
        $black = User::factory()->create();
        DB::table('rooms')->insert([
            'code' => 'MM1', 'p1_token' => 'a', 'p1_name' => 'W',
            'p1_user_id' => $white->id, 'p2_user_id' => $black->id,
        ]);
        $review = ['log' => [
            ['player' => 'white', 'notation' => '8/4', 'best' => '8/4', 'loss' => 0.0, 'dice' => [4, 2]],
            ['player' => 'white', 'notation' => '13/7', 'best' => '13/7', 'loss' => 0.0, 'dice' => [6, 1]],
            ['player' => 'white', 'notation' => '24/18', 'best' => '13/11 24/23', 'loss' => 0.12, 'dice' => [2, 1]],
            ['player' => 'black', 'notation' => '6/2', 'best' => '6/2', 'loss' => 0.0, 'dice' => [4, 0]],
        ]];
        DB::table('match_results')->insert([
            'user_id' => $white->id, 'won' => 1, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1510, 'delta' => 10,
            'room_code' => 'MM1', 'match_type' => 'match', 'match_length' => 5,
            'gnubg_review' => json_encode($review), 'created_at' => now(), 'updated_at' => now(),
        ]);

        $mm = CheatScan::moveMatch($white->id, 'MM1');
        $this->assertTrue($mm['ok']);
        $this->assertSame('white', $mm['color']);
        $this->assertSame(3, $mm['total']); // yalnız white'ın checker kararları (black elenir)
        $this->assertSame(2, $mm['exact']); // 2 hamle loss≈0 = motorun #1'i
        $this->assertSame(67, $mm['exact_pct']);
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

    public function test_closed_account_is_excluded_but_blocked_stays(): void
    {
        $closed = User::factory()->create(['nickname' => 'Closed']);
        $blocked = User::factory()->create(['nickname' => 'Blocked']);
        foreach ([$closed, $blocked] as $u) {
            $this->match($u->id, 0.8, 90);
            $this->match($u->id, 1.2, 110);
        }
        $this->assertCount(2, CheatScan::suspects());

        // Hesabı Kapat akışı → account_ban_events 'closed' → listeden düşer.
        DB::table('account_ban_events')->insert([
            'user_id' => $closed->id, 'action' => 'closed', 'actor_id' => 1,
            'reason' => 'test', 'created_at' => now(),
        ]);
        // Engelle (block) tabloya yazmaz → listede kalır.
        $suspects = CheatScan::suspects();
        $this->assertCount(1, $suspects);
        $this->assertSame($blocked->id, $suspects[0]['user_id']);

        // reopen → son olay 'reopened' → yeniden listelenir.
        DB::table('account_ban_events')->insert([
            'user_id' => $closed->id, 'action' => 'reopened', 'actor_id' => 1,
            'reason' => 'test', 'created_at' => now(),
        ]);
        $this->assertCount(2, CheatScan::suspects());
    }

    public function test_deleted_account_is_excluded(): void
    {
        // KVKK silme (anonimleştirme): maç satırları korunur ama hesap ban_reason='account_deleted'
        // + banned_at DOĞRUDAN yazılır (account_ban_events YOK). Triyaj listesinde yer kaplamamalı.
        $deleted = User::factory()->create(['nickname' => 'silinmis402', 'ban_reason' => 'account_deleted', 'banned_at' => now()]);
        $live = User::factory()->create(['nickname' => 'Live']);
        foreach ([$deleted, $live] as $u) {
            $this->match($u->id, 0.8, 90);
            $this->match($u->id, 1.2, 110);
        }

        $suspects = CheatScan::suspects();
        $this->assertCount(1, $suspects);
        $this->assertSame($live->id, $suspects[0]['user_id']);
    }

    public function test_whitelisted_user_is_excluded(): void
    {
        $cheat = User::factory()->create(['nickname' => 'Suspect']);
        $this->match($cheat->id, 0.8, 90);
        $this->match($cheat->id, 1.2, 110);
        $this->assertCount(1, CheatScan::suspects());

        CheatScan::setWhitelisted($cheat->id, true);
        $this->assertCount(0, CheatScan::suspects());

        CheatScan::setWhitelisted($cheat->id, false);
        $this->assertCount(1, CheatScan::suspects());
    }
}
