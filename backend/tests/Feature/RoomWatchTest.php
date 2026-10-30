<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * /rooms/{code}/watch izleyici heartbeat'i: aynı (room_code, token) tekrarı 1062 (duplicate key)
 * ile 500 vermemeli. Eski updateOrInsert SELECT→INSERT (atomik değil) iki eşzamanlı watch'ta
 * çarpıyordu; atomik upsert ile idempotent (Y38VR/myyldzr üretim 500'ü).
 */
class RoomWatchTest extends TestCase
{
    use RefreshDatabase;

    private function playingRoom(string $code): Room
    {
        $now = microtime(true);
        $p1 = User::factory()->create();
        $p2 = User::factory()->create();

        return Room::create([
            'code' => $code,
            'p1_token' => 't1', 'p1_user_id' => $p1->id, 'p1_name' => 'P1',
            'p2_token' => 't2', 'p2_user_id' => $p2->id, 'p2_name' => 'P2',
            'bot' => false,
            'status' => 'playing', 'mode' => 'friendly', 'time_control' => 'speed',
            'target' => 1, 'version' => 1, 'server_version' => 2,
            'server_state' => Backgammon::initialState(),
        ]);
    }

    public function test_repeated_watch_heartbeat_is_idempotent(): void
    {
        $room = $this->playingRoom('WATCH1');
        Sanctum::actingAs(User::factory()->create()); // izleyici (oyuncu değil)

        $payload = ['token' => 'spec-token-xyz', 'name' => 'Seyirci'];
        $this->postJson("/api/rooms/{$room->code}/watch", $payload)->assertOk();
        // İkinci heartbeat aynı token: eski updateOrInsert yarışında 1062→500 veriyordu; upsert idempotent.
        $this->postJson("/api/rooms/{$room->code}/watch", $payload)
            ->assertOk()
            ->assertJsonPath('count', 1);

        $this->assertSame(1, DB::table('room_viewers')
            ->where('room_code', 'WATCH1')->where('token', 'spec-token-xyz')->count());
    }
}
