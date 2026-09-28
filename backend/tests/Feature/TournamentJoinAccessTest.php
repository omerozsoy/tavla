<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Turnuva katılım kapısı turnuva başına (tournaments.premium_only):
 *  - premium_only=true  -> yalnız Premium katılır, normal üye 403 premium_required
 *  - premium_only=false -> tüm üyeler katılır
 *  - misafir hiçbir turnuvaya katılamaz (401)
 */
class TournamentJoinAccessTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick, bool $premium = false): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        if ($premium) {
            $u->forceFill(['plan' => 'star', 'plan_until' => now()->addMonth()])->save();
        }

        return $u->fresh();
    }

    private function tournament(bool $premiumOnly): Tournament
    {
        return Tournament::create([
            'name' => $premiumOnly ? 'Premium Kupa' : 'Herkes Kupa',
            'size' => 8, 'status' => 'open', 'players' => [], 'entry_fee' => 0,
            'premium_only' => $premiumOnly, 'active' => true,
        ]);
    }

    public function test_free_member_blocked_from_premium_only_tournament(): void
    {
        $t = $this->tournament(true);
        Sanctum::actingAs($this->user('free1'));

        $this->postJson("/api/tournaments/{$t->id}/join")
            ->assertStatus(403)
            ->assertJsonPath('code', 'premium_required');
        $this->assertCount(0, $t->fresh()->players ?? []);
    }

    public function test_premium_member_joins_premium_only_tournament(): void
    {
        $t = $this->tournament(true);
        $u = $this->user('prem1', premium: true);
        Sanctum::actingAs($u);

        $this->postJson("/api/tournaments/{$t->id}/join")->assertOk();
        $this->assertSame($u->id, $t->fresh()->players[0]['id'] ?? null);
    }

    public function test_free_member_joins_open_tournament(): void
    {
        $t = $this->tournament(false);
        $u = $this->user('free2');
        Sanctum::actingAs($u);

        $this->postJson("/api/tournaments/{$t->id}/join")->assertOk();
        $this->assertSame($u->id, $t->fresh()->players[0]['id'] ?? null);
    }

    public function test_guest_cannot_join_any_tournament(): void
    {
        $t = $this->tournament(false);

        $this->postJson("/api/tournaments/{$t->id}/join")->assertStatus(401);
    }

    public function test_list_exposes_premium_only_flag_to_guests(): void
    {
        $this->tournament(true);
        $this->tournament(false);

        $flags = collect($this->getJson('/api/tournaments')->assertOk()->json('tournaments'))
            ->pluck('premium_only')->sort()->values()->all();
        $this->assertSame([false, true], $flags);
    }
}
