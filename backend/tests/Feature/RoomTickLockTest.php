<?php

namespace Tests\Feature;

use App\Http\Controllers\RoomController;
use App\Models\Room;
use App\Models\User;
use App\Services\MatchClock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// A-14: poll (show -> tickClock) odayı KİLİTSİZ okuyup bayat kopyayı save() ediyordu. Bu arada
// eşzamanlı bir komut maçı bitirdiyse, bayat kopyadaki "terk" kararı GERÇEK sonucun üzerine yazılırdı.
class RoomTickLockTest extends TestCase
{
    use RefreshDatabase;

    public function test_stale_poll_copy_does_not_overwrite_concurrent_result(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $t0 = microtime(true) - 200;
        $c = MatchClock::init('casual', 1, $t0);
        $c = MatchClock::onUpdate($c, [
            'turnStart' => ['turn' => 'white'], 'turnsPlayed' => 0, 'played' => [], 'starter' => 'white',
            'match' => ['target' => 1, 'cube' => ['value' => 1, 'owner' => null], 'score' => ['white' => 0, 'black' => 0]],
        ], 'p1', $t0);
        $now = microtime(true);
        $c = MatchClock::seen($c, 'p1', $now);
        $c = MatchClock::seen($c, 'p2', $t0); // p2 uzun süredir görünmüyor -> poll "p2 terk" sanar
        $this->assertSame('ABANDON', MatchClock::tick($c, $now)['end']['reason'] ?? null);

        Room::create([
            'code' => 'TLK01', 'p1_token' => 't1', 'p1_user_id' => $a->id, 'p1_name' => 'A',
            'p2_token' => 't2', 'p2_user_id' => $b->id, 'p2_name' => 'B', 'status' => 'playing',
            'target' => 1, 'version' => 1, 'authoritative' => true, 'clock' => $c,
            'server_state' => \App\Support\Backgammon::initialState(),
            'server_match' => ['done' => false, 'target' => 1, 'score' => ['white' => 0, 'black' => 0],
                'cube' => ['value' => 1, 'owner' => null, 'pending' => null]],
        ]);
        $stale = Room::where('code', 'TLK01')->first(); // poll'un kilitsiz okuduğu kopya

        // Eşzamanlı komut: siyah (p2) maçı GERÇEKTEN kazanıp kapattı.
        Room::where('code', 'TLK01')->update([
            'server_match' => json_encode(['done' => true, 'winner' => 'black', 'target' => 1,
                'score' => ['white' => 0, 'black' => 1], 'cube' => ['value' => 1, 'owner' => null, 'pending' => null]]),
            'server_winner' => 'black', 'status' => 'finished', 'version' => 2,
        ]);

        app(RoomController::class)->tickClock($stale, 'p1');

        $room = Room::where('code', 'TLK01')->first();
        $this->assertSame('black', $room->server_match['winner'], 'gerçek sonuç ezilmemeli');
        $this->assertSame(1, (int) $room->server_match['score']['black']);
        $this->assertEmpty($room->clock['end'] ?? null, 'bayat terk kararı yazılmamalı');
        $this->assertSame('finished', $stale->status, 'çağıranın kopyası taze satırla senkronlanır');
    }
}
