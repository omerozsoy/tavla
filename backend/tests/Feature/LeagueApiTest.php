<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\League\LeagueRuntime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Lig API uçları (§16/§17): açık okuma, kullanıcı başvurusu (Premium), admin yetki kapısı.
 */
class LeagueApiTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::factory()->create();
        $u->forceFill(['is_admin' => true])->save();

        return $u;
    }

    private function premium(): User
    {
        return User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear()]);
    }

    public function test_public_can_read_league_index_without_auth(): void
    {
        $this->getJson('/api/league')->assertOk()->assertJsonStructure(['active', 'finished']);
    }

    public function test_non_admin_cannot_create_season(): void
    {
        Sanctum::actingAs($this->premium());
        $this->postJson('/api/league', ['name' => 'X'])->assertStatus(403);
    }

    public function test_admin_can_create_and_open_and_premium_user_applies(): void
    {
        Sanctum::actingAs($this->admin());
        $res = $this->postJson('/api/league', ['league_match_length' => 9])->assertOk();
        $seasonId = $res->json('season.id');
        $this->postJson("/api/league/{$seasonId}/open-applications", [
            'open_at' => now()->subMinute()->toIso8601String(),
            'close_at' => now()->addDay()->toIso8601String(),
        ])->assertOk();

        // Premium kullanıcı başvurur.
        $p = $this->premium();
        Sanctum::actingAs($p);
        $this->postJson("/api/league/{$seasonId}/apply")->assertOk()->assertJson(['ok' => true]);

        // Aynı kullanıcı ikinci kez başvuramaz (§2).
        $this->postJson("/api/league/{$seasonId}/apply")->assertStatus(422);
    }

    public function test_free_user_apply_rejected_by_server(): void
    {
        $season = LeagueRuntime::createSeason();
        LeagueRuntime::openApplications($season, now()->subMinute(), now()->addDay());

        Sanctum::actingAs(User::factory()->create(['plan' => 'free', 'plan_until' => null]));
        $this->postJson("/api/league/{$season->id}/apply")
            ->assertStatus(422)
            ->assertJson(['message' => 'Başvuru için Premium üyelik gerekir.']);
    }

    public function test_show_exposes_no_email(): void
    {
        $season = LeagueRuntime::createSeason();
        $body = $this->getJson("/api/league/{$season->id}")->assertOk()->json();
        $this->assertArrayHasKey('season', $body);
        // Açık yanıtta e-posta anahtarı hiçbir yerde olmamalı (§16).
        $this->assertStringNotContainsString('@', json_encode($body));
    }
}
