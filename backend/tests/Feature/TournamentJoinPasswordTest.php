<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Turnuva katılım şifresi (tournaments.join_password):
 *  - dolu -> doğru şifre girilmeden katılım 403 password_required, doğru şifreyle katılır
 *  - boş/null -> şifre sorulmaz (halka açık)
 *  - şifrenin kendisi listede/detayda SIZDIRILMAZ (yalnız has_password bayrağı)
 */
class TournamentJoinPasswordTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ])->fresh();
    }

    private function tournament(?string $pw): Tournament
    {
        return Tournament::create([
            'name' => 'Şifre Kupa', 'size' => 8, 'status' => 'open', 'players' => [],
            'entry_fee' => 0, 'premium_only' => false, 'active' => true, 'join_password' => $pw,
        ]);
    }

    public function test_wrong_or_missing_password_blocks_join(): void
    {
        $t = $this->tournament('gizli42');
        Sanctum::actingAs($this->user('a'));

        $this->postJson("/api/tournaments/{$t->id}/join")
            ->assertStatus(403)->assertJsonPath('code', 'password_required');
        $this->postJson("/api/tournaments/{$t->id}/join", ['password' => 'yanlis'])
            ->assertStatus(403)->assertJsonPath('code', 'password_required');
        $this->assertCount(0, $t->fresh()->players ?? []);
    }

    public function test_correct_password_joins(): void
    {
        $t = $this->tournament('gizli42');
        $u = $this->user('b');
        Sanctum::actingAs($u);

        $this->postJson("/api/tournaments/{$t->id}/join", ['password' => 'gizli42'])->assertOk();
        $this->assertSame($u->id, $t->fresh()->players[0]['id'] ?? null);
    }

    public function test_public_tournament_needs_no_password(): void
    {
        $t = $this->tournament(null);
        $u = $this->user('c');
        Sanctum::actingAs($u);

        $this->postJson("/api/tournaments/{$t->id}/join")->assertOk();
        $this->assertSame($u->id, $t->fresh()->players[0]['id'] ?? null);
    }

    public function test_password_not_leaked_only_flag(): void
    {
        $this->tournament('gizli42');
        $this->tournament(null);

        $rows = $this->getJson('/api/tournaments')->assertOk()->json('tournaments');
        $flags = collect($rows)->pluck('has_password')->sort()->values()->all();
        $this->assertSame([false, true], $flags);
        foreach ($rows as $r) {
            $this->assertArrayNotHasKey('join_password', $r);
        }
    }
}
