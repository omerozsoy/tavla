<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Faz 2 — TAM sunucu-otoriter oyun döngüsü (2 oyuncu, API üzerinden, uçtan uca).
 * 2-tarayıcı staging olmadan backend orkestrasyonunu doğrular: açılış+başlayan, hamle+tur
 * geçişi, sıra-dışı reddi, küp, resign, oyun kazanma. Validator Http::fake ile taklit.
 */
class AuthoritativeLoopTest extends TestCase
{
    use RefreshDatabase;

    private function room(int $target = 1): Room
    {
        return Room::create([
            'code' => 'LOOPX',
            'p1_token' => 'p1', 'p1_name' => 'W', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 0, 'target' => $target,
            'authoritative' => true,
            // server_state/server_match YOK -> roll() lazy-init + açılış yapar.
        ]);
    }

    /** Açılış elini at, başlayanı çöz; [starterColor, starterToken, otherColor, otherToken]. */
    private function openingRoll(): array
    {
        $r = $this->postJson('/api/rooms/LOOPX/roll', ['token' => 'p1'])->assertOk();
        $r->assertJsonPath('opening', true);
        $starter = $r->json('starter');
        $dice = $r->json('dice');
        $this->assertContains($starter, ['white', 'black']);
        $this->assertNotSame($dice[0], $dice[1]); // açılış asla berabere/çift

        return $starter === 'white'
            ? ['white', 'p1', 'black', 'p2']
            : ['black', 'p2', 'white', 'p1'];
    }

    // Validator: mevcut tahtayı verilen turn'e çevirip zarı boşaltarak "oynanmış" state döndür.
    private function fakeFlip(string $toTurn, array $off = ['white' => 0, 'black' => 0]): void
    {
        $s = Backgammon::initialState();
        $s['turn'] = $toTurn;
        $s['dice'] = [];
        $s['off'] = $off;
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $s])]);
    }

    public function test_opening_sets_starter_and_board(): void
    {
        $this->room();
        [$starter, , , ] = $this->openingRoll();
        $room = Room::first()->fresh();
        $this->assertTrue($room->server_match['opened']);
        $this->assertSame($starter, $room->server_state['turn']);
        $this->assertNotEmpty($room->server_state['dice']); // başlayan açılış zarını oynar
    }

    public function test_move_passes_turn_and_blocks_out_of_turn_roll(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room();
        [, $starterTok, $otherColor, $otherTok] = $this->openingRoll();

        // Başlayan hamle yapar -> sıra karşıya geçer.
        $this->fakeFlip($otherColor);
        $this->postJson('/api/rooms/LOOPX/move', ['token' => $starterTok, 'steps' => [['from' => 5, 'to' => 2, 'die' => 3]]])
            ->assertOk()->assertJsonPath('state.turn', $otherColor);

        // Sırası gelen oyuncu zar atabilir.
        $this->postJson('/api/rooms/LOOPX/roll', ['token' => $otherTok])->assertOk()
            ->assertJsonPath('opening', null); // artık açılış değil, normal el
        // Sırası OLMAYAN (az önce oynayan) zar atarsa 409.
        $this->postJson('/api/rooms/LOOPX/roll', ['token' => $starterTok])->assertStatus(409);
    }

    public function test_move_can_win_game_and_finish_match(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 1);
        [$starterColor, $starterTok, , ] = $this->openingRoll();

        // Başlayan 15 taşı toplar -> oyunu (ve target=1 maçı) kazanır.
        $this->fakeFlip($starterColor === 'white' ? 'black' : 'white', ['white' => 0, 'black' => 0, $starterColor => 15]);
        $res = $this->postJson('/api/rooms/LOOPX/move', ['token' => $starterTok, 'steps' => [['from' => 1, 'to' => 'off', 'die' => 1]]])
            ->assertOk();
        $res->assertJsonPath('winner', $starterColor)->assertJsonPath('match_done', true);

        $sm = Room::first()->fresh()->server_match;
        $this->assertTrue($sm['done']);
        $this->assertSame($starterColor, $sm['winner']);
        $this->assertGreaterThanOrEqual(1, $sm['score'][$starterColor]);
    }

    public function test_cube_offer_take_in_loop(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 5);
        [, $starterTok, $otherColor, $otherTok] = $this->openingRoll();

        // Başlayan oynar -> sıra karşıya. Karşı taraf zar atmadan ÖNCE küp teklif eder.
        $this->fakeFlip($otherColor);
        $this->postJson('/api/rooms/LOOPX/move', ['token' => $starterTok, 'steps' => [['from' => 5, 'to' => 2, 'die' => 3]]])->assertOk();

        $this->postJson('/api/rooms/LOOPX/cube/offer', ['token' => $otherTok])->assertOk();
        $this->assertSame($otherColor, Room::first()->fresh()->server_match['cube']['pending']);
        // Küp beklerken zar atılamaz.
        $this->postJson('/api/rooms/LOOPX/roll', ['token' => $otherTok])->assertStatus(409);
        // Rakip take -> ikiye katla, sahiplik devret, pending temizle.
        $this->postJson('/api/rooms/LOOPX/cube/respond', ['token' => $starterTok, 'action' => 'take'])
            ->assertOk()->assertJsonPath('action', 'take');
        $c = Room::first()->fresh()->server_match['cube'];
        $this->assertSame(2, $c['value']);
        $this->assertNull($c['pending']);
    }

    public function test_clock_follows_authoritative_turns(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 1);
        [$starter, $starterTok, $otherColor, ] = $this->openingRoll();

        // Açılıştan sonra saat ÇALIŞIYOR ve aktif = BAŞLAYAN (legacy update() olmadan da sürülüyor).
        $room = Room::first()->fresh();
        $this->assertNotEmpty($room->clock);
        $this->assertTrue($room->clock['running']);
        $this->assertSame($starter === 'white' ? 'p1' : 'p2', $room->clock['turn_slot']);

        // Başlayan hamle yapar -> saat aktifi KARŞIYA geçer (yanlış-oyuncu-süresi bug'ı fix).
        $this->fakeFlip($otherColor);
        $this->postJson('/api/rooms/LOOPX/move', ['token' => $starterTok, 'steps' => [['from' => 5, 'to' => 2, 'die' => 3]]])->assertOk();
        $room = Room::first()->fresh();
        $this->assertSame($otherColor === 'white' ? 'p1' : 'p2', $room->clock['turn_slot']);
    }

    public function test_resign_in_loop_awards_opponent(): void
    {
        $this->room(target: 1);
        [, $starterTok, $otherColor, ] = $this->openingRoll();

        // Başlayan pes eder -> rakip maçı kazanır.
        $this->postJson('/api/rooms/LOOPX/resign', ['token' => $starterTok])
            ->assertOk()->assertJsonPath('winner', $otherColor)->assertJsonPath('match_done', true);
        $this->assertSame($otherColor, Room::first()->fresh()->server_match['winner']);
    }
}
