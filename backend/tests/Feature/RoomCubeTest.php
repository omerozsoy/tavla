<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Faz 2 — sunucu-otoriter KÜP (doubling cube) + resign. Küp değeri/sahip/teklif SUNUCUDA;
 * istemci forge edemez. Küp motordan (hamle) bağımsız -> validator'a dokunmaz.
 */
class RoomCubeTest extends TestCase
{
    use RefreshDatabase;

    private function room(int $target = 1, array $cube = ['value' => 1, 'owner' => null, 'pending' => null], array $stateOverride = []): Room
    {
        $state = array_merge(Backgammon::initialState(), $stateOverride); // turn=white, dice=[]

        return Room::create([
            'code' => 'CUBEX',
            'p1_token' => 'p1', 'p1_name' => 'A', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 0, 'target' => $target,
            'authoritative' => true,
            'server_state' => $state,
            'server_match' => ['target' => $target, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1, 'done' => false, 'winner' => null, 'cube' => $cube],
        ]);
    }

    private function cube(Room $room): array
    {
        return $room->fresh()->server_match['cube'];
    }

    // ---- teklif ----
    public function test_offer_sets_pending(): void
    {
        $this->room();
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertOk();
        $this->assertSame('white', $this->cube(Room::first())['pending']);
    }

    public function test_offer_rejected_when_not_your_turn(): void
    {
        $this->room(); // turn=white
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p2'])->assertStatus(409);
    }

    public function test_offer_rejected_after_dice_rolled(): void
    {
        $this->room(stateOverride: ['dice' => [3, 1], 'diceUsed' => [false, false]]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertStatus(409);
    }

    public function test_offer_rejected_when_opponent_owns_cube(): void
    {
        $this->room(cube: ['value' => 2, 'owner' => 'black', 'pending' => null]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertStatus(409);
    }

    public function test_offer_allowed_when_you_own_cube(): void
    {
        $this->room(cube: ['value' => 2, 'owner' => 'white', 'pending' => null]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertOk();
        $this->assertSame('white', $this->cube(Room::first())['pending']);
    }

    // ---- teklif beklerken zar/hamle bloklu ----
    public function test_roll_blocked_while_cube_pending(): void
    {
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/roll', ['token' => 'p1'])->assertStatus(409);
    }

    // ---- yanıt: take ----
    public function test_respond_take_doubles_and_transfers_cube(): void
    {
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p2', 'action' => 'take'])
            ->assertOk()->assertJsonPath('action', 'take');
        $c = $this->cube(Room::first());
        $this->assertSame(2, $c['value']);
        $this->assertSame('black', $c['owner']); // take eden sahiplenir
        $this->assertNull($c['pending']);
    }

    // ---- yanıt: drop ----
    public function test_respond_drop_awards_current_value_and_continues_match(): void
    {
        $this->room(target: 3, cube: ['value' => 2, 'owner' => 'white', 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p2', 'action' => 'drop'])
            ->assertOk()->assertJsonPath('winner', 'white')->assertJsonPath('match_done', false);
        $sm = Room::first()->fresh()->server_match;
        $this->assertSame(2, $sm['score']['white']); // drop = MEVCUT küp değeri (gammon YOK)
        $this->assertSame(2, $sm['gameNo']);
        $this->assertSame(1, $sm['cube']['value']); // yeni oyun: küp ortada
        $this->assertNull($sm['cube']['owner']);
    }

    public function test_respond_drop_can_win_match(): void
    {
        $this->room(target: 1, cube: ['value' => 1, 'owner' => null, 'pending' => 'black']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p1', 'action' => 'drop'])
            ->assertOk()->assertJsonPath('winner', 'black')->assertJsonPath('match_done', true);
        $sm = Room::first()->fresh()->server_match;
        $this->assertTrue($sm['done']);
        $this->assertSame('black', $sm['winner']);
    }

    public function test_respond_rejected_from_offerer(): void
    {
        // Teklif eden kendi teklifini yanıtlayamaz (yalnız rakip).
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p1', 'action' => 'take'])->assertStatus(403);
    }

    public function test_respond_rejected_without_pending(): void
    {
        $this->room();
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p2', 'action' => 'take'])->assertStatus(409);
    }

    // ---- move: küp çarpanı ----
    public function test_move_applies_cube_multiplier_to_score(): void
    {
        config()->set('validator.url', 'http://validator.test');
        // Küp 2, zar atılmış; beyaz 15 taş toplayıp tek-puanlık maçı bitirecek -> 1(normal)×2=2.
        $this->room(target: 1, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            stateOverride: ['dice' => [6, 1], 'diceUsed' => [false, false]]);

        $won = Backgammon::initialState();
        $won['off'] = ['white' => 15, 'black' => 5]; // kaybeden topladı -> normal (1)
        $won['turn'] = 'black';
        $won['dice'] = [];
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $won])]);

        $this->postJson('/api/rooms/CUBEX/move', ['token' => 'p1', 'steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])
            ->assertOk()->assertJsonPath('match_done', true)->assertJsonPath('match.score.white', 2);
    }

    // ---- resign ----
    public function test_resign_awards_opponent_cube_value(): void
    {
        $this->room(target: 1, cube: ['value' => 2, 'owner' => 'black', 'pending' => null]);
        $this->postJson('/api/rooms/CUBEX/resign', ['token' => 'p1'])
            ->assertOk()->assertJsonPath('winner', 'black')->assertJsonPath('match_done', true);
        $this->assertSame(2, Room::first()->fresh()->server_match['score']['black']);
    }

    // ---- geriye uyum: authoritative olmayan odada küp uçları reddedilir ----
    public function test_cube_endpoints_require_authoritative_room(): void
    {
        Room::create([
            'code' => 'LEGCY', 'p1_token' => 'p1', 'p1_name' => 'A', 'p2_token' => 'p2', 'p2_name' => 'B',
            'status' => 'playing', 'version' => 0, 'authoritative' => false,
        ]);
        $this->postJson('/api/rooms/LEGCY/cube/offer', ['token' => 'p1'])->assertStatus(409);
        $this->postJson('/api/rooms/LEGCY/resign', ['token' => 'p1'])->assertStatus(409);
    }
}
