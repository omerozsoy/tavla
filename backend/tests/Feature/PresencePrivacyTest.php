<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-29: "Çevrimdışı Görün" profil/DM'de gerçek çevrimiçi durumu sızdırıyordu; engellenen kullanıcı
// davet gönderebiliyordu; davet/ping/okunma sayacı hız sınırsızdı.
class PresencePrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_appear_offline_is_respected_in_public_profile_and_dm_header(): void
    {
        $u = User::factory()->create(['last_seen' => now(), 'presence_status' => 'offline']);
        $this->getJson("/api/users/{$u->id}/profile")->assertOk()->assertJsonPath('online', false);
        Sanctum::actingAs(User::factory()->create());
        $res = $this->getJson("/api/messages/{$u->id}")->assertOk();
        $this->assertFalse((bool) data_get($res->json(), 'user.online', false));
    }

    public function test_online_still_shown_for_available_user(): void
    {
        $u = User::factory()->create(['last_seen' => now(), 'presence_status' => 'available']);
        $this->getJson("/api/users/{$u->id}/profile")->assertOk()->assertJsonPath('online', true);
    }

    public function test_blocked_user_cannot_send_game_invite(): void
    {
        [$a, $b] = User::factory()->count(2)->create(['presence_status' => 'available'])->all();
        DB::table('user_blocks')->insert(['blocker_id' => $b->id, 'blocked_id' => $a->id, 'created_at' => now()]);
        Sanctum::actingAs($a);
        $this->postJson("/api/friends/{$b->id}/invite")->assertStatus(409);
    }

    public function test_invite_is_rate_limited(): void
    {
        $a = User::factory()->create();
        Sanctum::actingAs($a);
        $codes = [];
        for ($i = 0; $i < 12; $i++) {
            $codes[] = $this->postJson('/api/friends/999999/invite')->getStatusCode();
        }
        $this->assertContains(429, $codes);
    }
}
