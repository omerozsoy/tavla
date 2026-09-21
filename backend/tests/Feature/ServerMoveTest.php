<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

// Sunucu-otoriter zar + hamle (para maÃ§Ä± gÃ¼venliÄŸi Faz 2b): server_state + validator + fail-closed.
class ServerMoveTest extends TestCase
{
    use RefreshDatabase;

    private function command(string $uri, array $payload): \Illuminate\Testing\TestResponse
    {
        $room = Room::where('code', 'ABCDE')->first()->fresh();
        return $this->postJson($uri, array_merge($payload, [
            'command_id' => (string) Str::uuid(),
            'expected_version' => $room->authoritative
                ? (int) $room->server_version
                : (int) $room->version,
        ]));
    }

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
            // AÃ§Ä±lÄ±ÅŸ (AdÄ±m C) GEÃ‡Ä°LDÄ° (opened=true) -> ilk roll NORMAL beyaz eli. Bu testler
            // hamle/validator/skoru sÄ±nar, aÃ§Ä±lÄ±ÅŸÄ± deÄŸil (beyaz baÅŸlar varsayÄ±mÄ± korunur).
            'server_state' => Backgammon::initialState(),
            'server_match' => ['target' => 1, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1,
                'done' => false, 'winner' => null, 'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
                'crawford' => false, 'crawfordDone' => false, 'opened' => true],
        ]);
    }

    private function blackTurnState(): array
    {
        $s = Backgammon::initialState();
        $s['turn'] = 'black'; // white oynadÄ± -> sÄ±ra black; zar temizlendi
        $s['dice'] = [];
        $s['diceUsed'] = [];

        return $s;
    }

    public function test_roll_initializes_state_and_prevents_reroll(): void
    {
        $this->room();

        // p1 (white) zar atar -> server_state kurulur, zar verilir
        $res = $this->command('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();
        $dice = $res->json('dice');
        $this->assertNotEmpty($dice);
        $this->assertContains(count($dice), [2, 4]); // normal veya Ã§ift(4)

        // RE-ROLL ENGELÄ°: tekrar isteyince AYNI zar (reused), yeni zar yok
        $res2 = $this->command('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();
        $res2->assertJsonPath('reused', true);
        $this->assertSame($dice, $res2->json('dice'));

        // AÃ‡ILIÅž Ä°STÄ°SNASI: p2 (black) aÃ§Ä±lÄ±ÅŸ sÄ±rasÄ±nda (turns=0, tahta taze) roll Ã§aÄŸÄ±rÄ±rsa
        // sÄ±ra-dÄ±ÅŸÄ± 409 DEÄžÄ°L, AYNI aÃ§Ä±lÄ±ÅŸÄ± alÄ±r (opening+reused). Bu KASITLI (aÃ§Ä±lÄ±ÅŸ-yarÄ±ÅŸÄ± bug
        // fix'i: aÃ§Ä±lÄ±ÅŸ yarÄ±ÅŸÄ±nÄ± kaybeden taraf "AÃ§Ä±lÄ±ÅŸ zarÄ± atÄ±lÄ±yorâ€¦"da kilitlenmesin diye
        // ikinci Ã§aÄŸÄ±rana da aÃ§Ä±lÄ±ÅŸ aynen dÃ¶ner; zar ÃœRETÄ°LMEZ -> idempotent + adil).
        // SÄ±ra-dÄ±ÅŸÄ± roll REDDÄ° (409) aÃ§Ä±lÄ±ÅŸ SONRASI iÃ§in AuthoritativeLoopTest'te kapsanÄ±r.
        $this->command('/api/rooms/ABCDE/roll', ['token' => 'tok-p2'])
            ->assertOk()->assertJsonPath('opening', true)->assertJsonPath('reused', true);
        $this->assertSame($dice, $this->command('/api/rooms/ABCDE/roll', ['token' => 'tok-p2'])->json('dice'));
    }

    public function test_move_validated_by_service_advances_state(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room();
        $this->command('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();

        Http::fake([
            'validator.test/validate' => Http::response(['valid' => true, 'state' => $this->blackTurnState()]),
        ]);

        $res = $this->command('/api/rooms/ABCDE/move', [
            'token' => 'tok-p1',
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertOk();
        $res->assertJsonPath('state.turn', 'black');

        $room = Room::where('code', 'ABCDE')->first();
        $this->assertSame('black', $room->server_state['turn']);
        $this->assertSame([], $room->server_state['dice']); // zar tÃ¼ketildi
    }

    public function test_move_rejects_illegal(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room();
        $this->command('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();

        Http::fake([
            'validator.test/validate' => Http::response(['valid' => false, 'reason' => 'illegal-step']),
        ]);

        $this->command('/api/rooms/ABCDE/move', [
            'token' => 'tok-p1',
            'steps' => [['from' => 0, 'to' => 5, 'die' => 5]],
        ])->assertStatus(422)->assertJsonPath('reason', 'illegal-step');
    }

    public function test_move_fail_closed_when_validator_unreachable(): void
    {
        config()->set('validator.url', 'http://validator.test');
        config()->set('validator.required', true);
        $this->room();
        $this->command('/api/rooms/ABCDE/roll', ['token' => 'tok-p1'])->assertOk();

        // Validator eriÅŸilemez -> istisna -> service unreachable -> fail-closed 503
        Http::fake([
            'validator.test/*' => function () {
                throw new \Illuminate\Http\Client\ConnectionException('conn refused');
            },
        ]);

        $this->command('/api/rooms/ABCDE/move', [
            'token' => 'tok-p1',
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertStatus(503);
    }

    public function test_move_requires_dice_first(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room();
        // Zar atmadan hamle -> 409 (Ã¶nce zar at)
        $this->command('/api/rooms/ABCDE/move', [
            'token' => 'tok-p1',
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertOk()->assertJsonPath('ignored', true);
    }
}
