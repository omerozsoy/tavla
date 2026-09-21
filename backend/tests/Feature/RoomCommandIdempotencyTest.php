<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoomCommandIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_authoritative_roll_requires_command_id(): void
    {
        $user = User::factory()->create(['coins' => 1000]);
        Sanctum::actingAs($user);
        $room = $this->room($user);

        $this->postJson("/api/rooms/{$room->code}/roll", [
            'token' => 'p1-token',
            'expected_version' => 0,
        ])->assertStatus(428)->assertJsonPath('reason', 'command-id-required');

        $this->assertSame(0, (int) $room->fresh()->server_version);
    }

    public function test_replayed_authoritative_roll_does_not_change_state_twice(): void
    {
        $user = User::factory()->create(['coins' => 1000]);
        Sanctum::actingAs($user);
        $room = $this->room($user);
        $commandId = (string) Str::uuid();

        $first = $this->postJson("/api/rooms/{$room->code}/roll", [
            'token' => 'p1-token',
            'command_id' => $commandId,
            'expected_version' => 0,
        ])->assertOk();
        $this->assertSame(1, (int) $first->json('version'));

        $this->postJson("/api/rooms/{$room->code}/roll", [
            'token' => 'p1-token',
            'command_id' => $commandId,
            'expected_version' => 1,
        ])->assertStatus(409)->assertJsonPath('reason', 'command-replayed');

        $fresh = $room->fresh();
        $this->assertSame(1, (int) $fresh->server_version);
        $this->assertCount(1, $fresh->dice_rolls ?? []);
        $this->assertDatabaseCount('room_commands', 1);
        $this->assertDatabaseHas('room_commands', [
            'room_id' => $fresh->id,
            'command_id' => $commandId,
            'result_version' => 1,
        ]);
    }

    public function test_stale_version_does_not_consume_command_receipt(): void
    {
        $user = User::factory()->create(['coins' => 1000]);
        Sanctum::actingAs($user);
        $room = $this->room($user);
        $commandId = (string) Str::uuid();

        $this->postJson("/api/rooms/{$room->code}/roll", [
            'token' => 'p1-token',
            'command_id' => $commandId,
            'expected_version' => 99,
        ])->assertStatus(409)->assertJsonPath('reason', 'stale-version');

        $this->assertDatabaseCount('room_commands', 0);

        $this->postJson("/api/rooms/{$room->code}/roll", [
            'token' => 'p1-token',
            'command_id' => $commandId,
            'expected_version' => 0,
        ])->assertOk();

        $this->assertDatabaseCount('room_commands', 1);
    }

    public function test_cube_and_resign_require_command_id(): void
    {
        $user = User::factory()->create(['coins' => 1000]);
        Sanctum::actingAs($user);
        $room = $this->room($user);

        $this->postJson("/api/rooms/{$room->code}/cube/offer", [
            'token' => 'p1-token',
            'expected_version' => 0,
        ])->assertStatus(428)->assertJsonPath('reason', 'command-id-required');

        $this->postJson("/api/rooms/{$room->code}/resign", [
            'token' => 'p1-token',
            'expected_version' => 0,
        ])->assertStatus(428)->assertJsonPath('reason', 'command-id-required');

        $this->assertDatabaseCount('room_commands', 0);
    }

    private function room(User $user): Room
    {
        return Room::create([
            'code' => 'CMD'.random_int(100, 999),
            'p1_token' => 'p1-token',
            'p1_user_id' => $user->id,
            'p1_name' => $user->nickname,
            'p2_token' => 'p2-token',
            'p2_name' => 'Opponent',
            'status' => 'playing',
            'mode' => 'friendly',
            'authoritative' => true,
            'stake' => 0,
            'bet_pct' => 0,
            'version' => 0,
            'server_version' => 0,
        ]);
    }
}
