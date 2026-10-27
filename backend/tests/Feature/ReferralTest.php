<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use App\Support\Referral;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Arkadaş davet (referral): ödül YALNIZ davet edilenin İLK puanlı online insan maçında (bota karşı
 * DEĞİL, davet edenine karşı DEĞİL) iki tarafa bir kez verilir. Kayıt davet koduyla bağlar.
 */
class ReferralTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick, int $coins = 0): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins;
        $u->save();

        return $u;
    }

    /** Davet edilenin verdiği UYGUN maç satırını üret. */
    private function match(User $invited, array $overrides = []): MatchResult
    {
        return MatchResult::create(array_merge([
            'user_id' => $invited->id,
            'won' => true,
            'rated' => true,
            'match_type' => 'match',
            'room_code' => 'ROOM1',
            'opponent_user_id' => 999, // davet eden DEĞİL
            'opponent_rating' => 1400,
            'rating_before' => 1400,
            'rating_after' => 1410,
            'delta' => 10,
        ], $overrides));
    }

    public function test_register_with_code_links_inviter(): void
    {
        $inviter = $this->user('inviter');
        $code = Referral::codeFor($inviter);

        $this->postJson('/api/register', [
            'first_name' => 'Yeni', 'last_name' => 'Uye', 'country' => 'TR', 'province' => 'İstanbul',
            'nickname' => 'yeniuye', 'email' => 'yeni@example.com', 'phone' => '05551112233',
            'password' => 'SuperSecret12', 'referral_code' => $code,
        ])->assertCreated();

        $this->assertSame($inviter->id, User::where('email', 'yeni@example.com')->first()->referred_by);
    }

    public function test_first_rated_online_match_rewards_both(): void
    {
        $inviter = $this->user('inviter', 100);
        $invited = $this->user('invited', 0);
        $invited->referred_by = $inviter->id;
        $invited->save();

        Referral::maybeReward($this->match($invited));

        $this->assertSame(5000, $invited->fresh()->coins);
        $this->assertSame(5100, $inviter->fresh()->coins);
        $this->assertNotNull($invited->fresh()->referral_rewarded_at);
        $this->assertSame(1, $inviter->fresh()->referral_count);
        // Ödül bildirimi: iki tarafa da (uygulama-içi kayıt).
        $this->assertDatabaseHas('notifications', ['user_id' => $invited->id, 'icon' => 'gift']);
        $this->assertDatabaseHas('notifications', ['user_id' => $inviter->id, 'icon' => 'gift']);
    }

    public function test_reward_granted_only_once(): void
    {
        $inviter = $this->user('inviter');
        $invited = $this->user('invited');
        $invited->referred_by = $inviter->id;
        $invited->save();

        Referral::maybeReward($this->match($invited));
        Referral::maybeReward($this->match($invited, ['room_code' => 'ROOM2']));

        $this->assertSame(5000, $invited->fresh()->coins); // çift ödül yok
        $this->assertSame(1, $inviter->fresh()->referral_count);
    }

    public function test_bot_and_unrated_and_offline_do_not_reward(): void
    {
        $inviter = $this->user('inviter');
        $invited = $this->user('invited');
        $invited->referred_by = $inviter->id;
        $invited->save();

        Referral::maybeReward($this->match($invited, ['match_type' => 'ai', 'room_code' => 'R_AI']));          // bota karşı
        Referral::maybeReward($this->match($invited, ['rated' => false, 'room_code' => 'R_UNRATED']));          // puansız
        Referral::maybeReward($this->match($invited, ['room_code' => null]));            // offline

        $this->assertSame(0, $invited->fresh()->coins);
        $this->assertNull($invited->fresh()->referral_rewarded_at);
    }

    public function test_match_vs_inviter_rewards(): void
    {
        $inviter = $this->user('inviter');
        $invited = $this->user('invited');
        $invited->referred_by = $inviter->id;
        $invited->save();

        // Davet edene karşı puanlı online maç da artık ödül verir (farm kalkanı kaldırıldı).
        Referral::maybeReward($this->match($invited, ['opponent_user_id' => $inviter->id, 'room_code' => 'R_INV']));

        $reward = Referral::reward();
        $this->assertSame($reward, $invited->fresh()->coins);
        $this->assertSame($reward, $inviter->fresh()->coins);
        $this->assertNotNull($invited->fresh()->referral_rewarded_at);
        $this->assertSame(1, $inviter->fresh()->referral_count);
    }

    public function test_invite_rejects_self_and_existing_email(): void
    {
        $me = $this->user('me');
        $other = $this->user('other');
        Sanctum::actingAs($me);

        $this->postJson('/api/me/referral/invite', ['email' => $me->email])->assertStatus(422);
        $this->postJson('/api/me/referral/invite', ['email' => $other->email])->assertStatus(422);
    }
}
