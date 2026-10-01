<?php

namespace Tests\Feature;

use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * GERÇEK-ZAMANLI PUSH ("A" adımı): oyun aksiyonu non-bot odada RoomUpdated yayınlar (rakip 1.2sn
 * poll beklemez); bot odası YAYINLAMAZ (tek-insan). Event::fake -> gerçek Reverb gerekmez; wiring'i
 * doğrular. Yayın DORMANT'tır (BROADCAST_CONNECTION=null) ama event yine dispatch edilir (fake yakalar).
 */
class RoomBroadcastTest extends TestCase
{
    use RefreshDatabase;

    private function playingRoom(string $code, bool $bot = false): Room
    {
        $now = microtime(true);
        $p1 = User::factory()->create();
        $p2 = $bot ? null : User::factory()->create();

        return Room::create([
            'code' => $code,
            'p1_token' => 't1', 'p1_user_id' => $p1->id, 'p1_name' => 'P1',
            'p2_token' => 't2', 'p2_user_id' => $p2?->id, 'p2_name' => $bot ? 'Bot' : 'P2',
            'bot' => $bot,
            'status' => 'playing', 'mode' => 'friendly', 'time_control' => 'speed',
            'target' => 1, 'authoritative' => true, 'dice_authority' => true,
            'version' => 1, 'server_version' => 2,
            // Sıra p1 (white), zar BOŞ -> roll geçerli.
            'server_state' => array_merge(\App\Support\Backgammon::initialState(), [
                'turn' => 'white', 'dice' => [], 'diceUsed' => [],
            ]),
            'server_match' => [
                'target' => 1, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1,
                'done' => false, 'winner' => null,
                'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
                'crawford' => false, 'crawfordDone' => false, 'opened' => true, 'turns' => 2,
            ],
            'clock' => [
                'running' => true, 'turn_slot' => 'p1',
                'p1_bank' => 24, 'p2_bank' => 24, 'delay' => 8,
                'started_at' => $now, 'moved' => true,
                'p1_seen' => $now, 'p2_seen' => $now,
            ],
        ]);
    }

    public function test_roll_broadcasts_room_update_for_human_room(): void
    {
        Event::fake([RoomUpdated::class]);
        $room = $this->playingRoom('BRDHUM');
        Sanctum::actingAs($room->p1_user_id ? User::find($room->p1_user_id) : User::factory()->create());

        $this->postJson('/api/rooms/BRDHUM/roll', [
            'token' => 't1', 'expected_version' => 2,
            'command_id' => '11111111-1111-1111-1111-111111111111',
        ])->assertOk();

        Event::assertDispatched(RoomUpdated::class, fn (RoomUpdated $e) => $e->code === 'BRDHUM');
    }

    public function test_bot_room_does_not_broadcast(): void
    {
        Event::fake([RoomUpdated::class]);
        $room = $this->playingRoom('BRDBOT', bot: true);
        Sanctum::actingAs(User::find($room->p1_user_id));

        // Roll başarılı olsun ya da bot sürülemesin fark etmez: broadcastRoom bot odasını ATLAR.
        $this->postJson('/api/rooms/BRDBOT/roll', [
            'token' => 't1', 'expected_version' => 2,
            'command_id' => '22222222-2222-2222-2222-222222222222',
        ]);

        Event::assertNotDispatched(RoomUpdated::class);
    }
}
