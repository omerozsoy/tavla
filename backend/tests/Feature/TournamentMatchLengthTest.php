<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Turnuva mac uzunluklari: normal turlar match_length; yari final / final ayri secilebilir,
// secilmezse normal tur uzunlugu. Oda uzunlugu sunucuda belirlenir (istemci degeri yok sayilir).
class TournamentMatchLengthTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    public function test_round_target_uses_semi_and_final_overrides(): void
    {
        $t = new Tournament(['match_length' => 7, 'semi_length' => null, 'final_length' => 15]);
        // 16 kisilik: 4 tur -> 0,1 normal, 2 yari final, 3 final
        $this->assertSame(7, $t->roundTarget(0, 4));
        $this->assertSame(7, $t->roundTarget(1, 4));
        $this->assertSame(7, $t->roundTarget(2, 4)); // yari final secilmedi -> normal
        $this->assertSame(15, $t->roundTarget(3, 4));

        $t->semi_length = 9;
        $this->assertSame(9, $t->roundTarget(2, 4));

        // Hic secim yok (eski turnuvalar): tek oyun
        $old = new Tournament([]);
        $this->assertSame(1, $old->roundTarget(0, 2));
        $this->assertSame(1, $old->roundTarget(1, 2));
    }

    public function test_match_room_sets_semi_final_length_server_side(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $c = $this->user('c');
        $d = $this->user('d');
        $t = Tournament::create([
            'name' => 'T', 'size' => 4, 'status' => 'running',
            'match_length' => 5, 'semi_length' => 9, 'final_length' => 15,
            'players' => [],
            'bracket' => [
                [ // round 0 = yari final (4 kisi)
                    ['key' => 'm0', 'p1' => ['id' => $a->id, 'name' => 'A'], 'p2' => ['id' => $b->id, 'name' => 'B']],
                    ['key' => 'm1', 'p1' => ['id' => $c->id, 'name' => 'C'], 'p2' => ['id' => $d->id, 'name' => 'D']],
                ],
                [['key' => 'f0', 'p1' => null, 'p2' => null]], // final
            ],
        ]);

        Sanctum::actingAs($a);
        $res = $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => 'm0'])->assertOk();
        $this->assertSame(9, $res->json('target'));
        $code = $res->json('code');

        // Istemci farkli target gonderse bile oda sunucunun uzunluguyla kurulur.
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'tokA', 'name' => 'A', 'target' => 1])
            ->assertOk();
        $this->assertSame(9, (int) Room::where('code', $code)->first()->target);
        $this->assertSame(9, $t->fresh()->bracket[0][0]['target']);
    }

    public function test_auto_start_happens_exactly_at_register_until(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $t = Tournament::create([
            'name' => 'T', 'size' => 4, 'status' => 'open', 'active' => true,
            'register_until' => now()->subSecond(),
            'players' => [['id' => $a->id, 'name' => 'A', 'rating' => 1500], ['id' => $b->id, 'name' => 'B', 'rating' => 1500]],
        ]);

        $this->getJson('/api/tournaments')->assertOk();
        $this->assertSame('running', $t->fresh()->status);
    }
}
