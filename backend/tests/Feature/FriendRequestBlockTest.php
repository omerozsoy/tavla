<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Blok (user_blocks), arkadaşlık isteğini iki yönde de kesmeli (DM/davet ile simetri).
class FriendRequestBlockTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    private function block(int $blocker, int $blocked): void
    {
        DB::table('user_blocks')->insert([
            'blocker_id' => $blocker, 'blocked_id' => $blocked, 'created_at' => now(),
        ]);
    }

    public function test_blocked_target_cannot_be_friend_requested(): void
    {
        $me = $this->user('me');
        $target = $this->user('target');
        $this->block($me->id, $target->id); // ben hedefi blokladım

        Sanctum::actingAs($me);
        $this->postJson('/api/friends/request', ['user_id' => $target->id])
            ->assertStatus(403);

        $this->assertDatabaseCount('friendships', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_request_blocked_in_reverse_direction_too(): void
    {
        $me = $this->user('me');
        $target = $this->user('target');
        $this->block($target->id, $me->id); // hedef beni blokladı

        Sanctum::actingAs($me);
        $this->postJson('/api/friends/request', ['user_id' => $target->id])
            ->assertStatus(403);

        $this->assertDatabaseCount('friendships', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_unblocked_request_still_works(): void
    {
        $me = $this->user('me');
        $target = $this->user('target');

        Sanctum::actingAs($me);
        $this->postJson('/api/friends/request', ['user_id' => $target->id])
            ->assertOk()
            ->assertJsonPath('status', 'pending');

        $this->assertDatabaseCount('friendships', 1);
    }
}
