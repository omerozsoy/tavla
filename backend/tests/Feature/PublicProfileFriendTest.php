<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Public profil: bakan kişiyle ZATEN arkadaşsa is_friend=true -> frontend "Arkadaş ol"u gizler.
class PublicProfileFriendTest extends TestCase
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

    public function test_guest_viewer_is_not_friend(): void
    {
        $target = $this->user('target');
        $this->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('is_friend', false);
    }

    public function test_non_friend_viewer_is_false(): void
    {
        $me = $this->user('me');
        $target = $this->user('target');
        Sanctum::actingAs($me);
        $this->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('is_friend', false);
    }

    public function test_pending_request_is_not_friend(): void
    {
        $me = $this->user('me');
        $target = $this->user('target');
        DB::table('friendships')->insert([
            'user_id' => $me->id, 'friend_id' => $target->id, 'status' => 'pending',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Sanctum::actingAs($me);
        $this->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('is_friend', false);
    }

    public function test_accepted_friend_is_true_both_directions(): void
    {
        $me = $this->user('me');
        $target = $this->user('target');
        // Kayıt hedef tarafından açılmış olabilir (friend_id=me) -> çift yön kontrol edilmeli.
        DB::table('friendships')->insert([
            'user_id' => $target->id, 'friend_id' => $me->id, 'status' => 'accepted',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Sanctum::actingAs($me);
        $this->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('is_friend', true);
    }
}
