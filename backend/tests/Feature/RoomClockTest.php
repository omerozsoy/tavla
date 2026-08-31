<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Sunucu-otoriter saat + AFK'nin HTTP katmani: eslesme tempo sarti, clock init,
// ve poll (show) sirasinda timeout/AFK enforce (started_at gecmise enjekte edilir ->
// gercek beklemeye gerek yok).
class RoomClockTest extends TestCase
{
    use RefreshDatabase;

    private function playingRoom(string $code, string $mode, int $target): Room
    {
        return Room::create([
            'code' => $code,
            'p1_token' => 't1',
            'p1_name' => 'P1',
            'p2_token' => 't2',
            'p2_name' => 'P2',
            'status' => 'playing',
            'mode' => 'ranked',
            'time_control' => $mode,
            'target' => $target,
            'version' => 1,
        ]);
    }

    private function state(int $target, string $turn = 'white'): array
    {
        return [
            'match' => ['target' => $target, 'cube' => ['value' => 1, 'owner' => null], 'score' => ['white' => 0, 'black' => 0]],
            'turnStart' => ['turn' => $turn],
            'played' => [],
            'starter' => 'white',
            'turnsPlayed' => 0,
        ];
    }

    // ---- Eslesme: yalniz AYNI tempo ----
    public function test_matchmaking_pairs_only_same_time_control(): void
    {
        $this->postJson('/api/matchmaking', ['token' => 'A', 'name' => 'A', 'targets' => [5], 'time_control' => 'normal'])
            ->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // Farkli tempo -> A ile ESLESMEZ, kendi havuzuna girer
        $this->postJson('/api/matchmaking', ['token' => 'B', 'name' => 'B', 'targets' => [5], 'time_control' => 'speed'])
            ->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // Ayni tempo -> A ile eslesir
        $this->postJson('/api/matchmaking', ['token' => 'C', 'name' => 'C', 'targets' => [5], 'time_control' => 'normal'])
            ->assertOk()->assertJson(['matched' => true, 'slot' => 'p2']);
    }

    // ---- update saati kurar + clock doner; show clock doner ----
    public function test_update_initializes_and_returns_clock(): void
    {
        $this->playingRoom('CLK1', 'normal', 5); // normal 5 -> banka 300

        $res = $this->putJson('/api/rooms/CLK1', ['token' => 't1', 'state' => $this->state(5)])->assertOk();
        $clock = $res->json('clock');
        $this->assertSame('white', $clock['active']);
        $this->assertGreaterThanOrEqual(299, $clock['white']);
        $this->assertLessThanOrEqual(300, $clock['white']);
        $this->assertEqualsWithDelta(300, $clock['black'], 1.0);

        // show da clock icermeli
        $showClock = $this->getJson('/api/rooms/CLK1')->assertOk()->json('room.clock');
        $this->assertSame('white', $showClock['active']);
    }

    // ---- show TIMEOUT'u enforce eder (speed 1: ana sure 45sn'den once biter) ----
    public function test_show_enforces_timeout(): void
    {
        $room = $this->playingRoom('CLK2', 'speed', 1); // banka 24, delay 8 -> timeout 32sn
        $this->putJson('/api/rooms/CLK2', ['token' => 't1', 'state' => $this->state(1)])->assertOk();

        // started_at'i gecmise it: 40sn once (timeout 32 gecti, afk 45 henuz)
        $room->refresh();
        $clock = $room->clock;
        $clock['started_at'] = microtime(true) - 40;
        $room->clock = $clock;
        $room->save();

        $this->getJson('/api/rooms/CLK2')->assertOk();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('TIMEOUT', $room->end_reason);
        $this->assertSame('lost', $room->p1_result); // beyaz(p1) suresi bitti
        $this->assertSame('won', $room->p2_result);
        $this->assertNotEmpty($room->state['gameEnd']);
        $this->assertSame('black', $room->state['gameEnd']['winner']);
    }

    // ---- show AFK_TIMEOUT'u enforce eder (casual 5: ana sure uzun, once AFK) ----
    public function test_show_enforces_afk_timeout(): void
    {
        $room = $this->playingRoom('CLK3', 'casual', 5); // banka 900 -> timeout cok ileride
        $this->putJson('/api/rooms/CLK3', ['token' => 't1', 'state' => $this->state(5)])->assertOk();

        $room->refresh();
        $clock = $room->clock;
        $clock['started_at'] = microtime(true) - 50; // afk 45 gecti
        $room->clock = $clock;
        $room->save();

        $this->getJson('/api/rooms/CLK3')->assertOk();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('AFK_TIMEOUT', $room->end_reason);
        $this->assertSame('won', $room->p2_result);
    }

    // ---- Rakip (sira sahibi degil) update'i AFK'yi sifirlayamaz (forge korumasi) ----
    public function test_non_owner_update_does_not_reset_afk(): void
    {
        $room = $this->playingRoom('CLK4', 'casual', 5);
        $this->putJson('/api/rooms/CLK4', ['token' => 't1', 'state' => $this->state(5)])->assertOk();

        // started_at'i 40sn geriye it (afk sayiyor)
        $room->refresh();
        $clock = $room->clock;
        $startWas = microtime(true) - 40;
        $clock['started_at'] = $startWas;
        $room->clock = $clock;
        $room->save();

        // p2 (sira sahibi DEGIL) imza degistiren update gonderir -> started_at DEGISMEMELI
        $forge = $this->state(5);
        $forge['turnsPlayed'] = 9;
        $forge['played'] = [['x' => 1], ['x' => 1]];
        $this->putJson('/api/rooms/CLK4', ['token' => 't2', 'state' => $forge])->assertOk();

        $room->refresh();
        $this->assertEqualsWithDelta($startWas, $room->clock['started_at'], 0.5);
        $this->assertSame('p1', $room->clock['turn_slot']);
    }
}
