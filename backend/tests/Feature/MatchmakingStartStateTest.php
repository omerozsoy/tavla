<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MatchmakingStartStateTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        $user = User::create([
            'first_name' => $nick,
            'last_name' => 'E2E',
            'country' => 'TR',
            'nickname' => $nick,
            'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
            'email_verified_at' => now(),
        ]);
        // User::$fillable does not include the verification column.
        $user->email_verified_at = now();
        $user->save();

        return $user;
    }

    public function test_matchmaking_transition_is_visible_to_poll_and_has_initial_state(): void
    {
        $p1 = $this->user('match-p1');
        $p2 = $this->user('match-p2');

        Sanctum::actingAs($p1);
        $waiting = $this->postJson('/api/matchmaking', [
            'token' => 'p1-token',
            'name' => 'P1',
            'targets' => [1],
            'time_control' => 'normal',
        ])->assertOk()->json();

        $code = $waiting['room']['code'];
        $waitingVersion = (int) $waiting['room']['version'];

        Sanctum::actingAs($p2);
        $this->postJson('/api/matchmaking', [
            'token' => 'p2-token',
            'name' => 'P2',
            'targets' => [1],
            'time_control' => 'normal',
        ])->assertOk()->assertJsonPath('room.status', 'playing');

        $room = Room::where('code', $code)->firstOrFail();
        $this->assertSame('playing', $room->status);
        $this->assertGreaterThan($waitingVersion, (int) $room->version);
        $this->assertTrue((bool) $room->authoritative);
        $this->assertNotNull($room->server_state);
        $this->assertSame(1, (int) $room->server_version);
        // enter() ile simetri: server_match de tohumlanmalı (target set) ki iki istemci
        // ilk roll'dan ÖNCE aynı maç uzunluğunu görsün (küp 409 penceresi kapanır).
        $this->assertIsArray($room->server_match);
        $this->assertSame(1, (int) ($room->server_match['target'] ?? 0));

        // P1'in son gördüğü bekleme sürümüyle yaptığı poll, 204 yerine eşleşmiş odayı
        // vermeli; bu, frontend'in home/lobby durumundan game-view'a geçmesinin sözleşmesidir.
        Sanctum::actingAs($p1);
        $poll = $this->getJson("/api/rooms/{$code}?token=p1-token&since={$waitingVersion}")
            ->assertOk()
            ->assertJsonPath('room.status', 'playing')
            ->assertJsonPath('room.server_version', 1);
        $state = $poll->json('room.server_state');
        $this->assertIsArray($state);
        $this->assertCount(24, $state['points']);
    }
}
