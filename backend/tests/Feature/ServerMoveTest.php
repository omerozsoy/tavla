<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Sunucu-otoriter zar + hamle (para maçı güvenliği Faz 2b): server_state + validator + fail-closed.
class ServerMoveTest extends TestCase
{
    use RefreshDatabase;

    private function room(): Room
    {
        return Room::create([
            'code' => 'ABCDE',
            'p1_token' => 'tok-p1',
            'p1_name' => 'P1',
            'p2_token' => 'tok-p2',
            'p2_name' => 'P2',
            'status' => 'playing',
            'version' => 0,
        ]);
    }

    private function blackTurnState(): array
    {
        $s = Backgammon::initialState();
        $s['turn'] = 'black'; // white oynadı -> sıra black; zar temizlendi
        $s['dice'] = [];
        $s['diceUsed'] = [];

        return $s;
    }

    public function test_roll_initializes_state_and_prevents_reroll(): void
    {
        $this->room();

        // p1 (white) zar atar -> server_state kurulur, zar verilir
        $res = $this->postJson('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();
        $dice = $res->json('dice');
        $this->assertNotEmpty($dice);
        $this->assertContains(count($dice), [2, 4]); // normal veya çift(4)

        // RE-ROLL ENGELİ: tekrar isteyince AYNI zar (reused), yeni zar yok
        $res2 = $this->postJson('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();
        $res2->assertJsonPath('reused', true);
        $this->assertSame($dice, $res2->json('dice'));

        // p2 (black) sırası değil -> 409
        $this->postJson('/api/rooms/ABCDE/roll', ['token' => 'tok-p2'])->assertStatus(409);
    }

    public function test_move_validated_by_service_advances_state(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room();
        $this->postJson('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();

        Http::fake([
            'validator.test/validate' => Http::response(['valid' => true, 'state' => $this->blackTurnState()]),
        ]);

        $res = $this->postJson('/api/rooms/ABCDE/move', [
            'token' => 'tok-p1',
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertOk();
        $res->assertJsonPath('state.turn', 'black');

        $room = Room::where('code', 'ABCDE')->first();
        $this->assertSame('black', $room->server_state['turn']);
        $this->assertSame([], $room->server_state['dice']); // zar tüketildi
    }

    public function test_move_rejects_illegal(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room();
        $this->postJson('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();

        Http::fake([
            'validator.test/validate' => Http::response(['valid' => false, 'reason' => 'illegal-step']),
        ]);

        $this->postJson('/api/rooms/ABCDE/move', [
            'token' => 'tok-p1',
            'steps' => [['from' => 0, 'to' => 5, 'die' => 5]],
        ])->assertStatus(422)->assertJsonPath('reason', 'illegal-step');
    }

    public function test_move_fail_closed_when_validator_unreachable(): void
    {
        config()->set('validator.url', 'http://validator.test');
        config()->set('validator.required', true);
        $this->room();
        $this->postJson('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();

        // Validator erişilemez -> istisna -> service unreachable -> fail-closed 503
        Http::fake([
            'validator.test/*' => function () {
                throw new \Illuminate\Http\Client\ConnectionException('conn refused');
            },
        ]);

        $this->postJson('/api/rooms/ABCDE/move', [
            'token' => 'tok-p1',
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertStatus(503);
    }

    public function test_move_requires_dice_first(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room();
        // Zar atmadan hamle -> 409 (önce zar at)
        $this->postJson('/api/rooms/ABCDE/move', [
            'token' => 'tok-p1',
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertStatus(409);
    }
}
