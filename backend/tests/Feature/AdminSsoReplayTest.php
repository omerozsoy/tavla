<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSsoReplayTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sso_link_is_single_use_without_revoking_api_token(): void
    {
        $admin = User::factory()->create([
            'is_admin' => true,
            'email_verified_at' => now(),
        ]);
        $plainTextToken = $admin->createToken('sso-test')->plainTextToken;

        $this->get('/admin/enter?token='.urlencode($plainTextToken))
            ->assertRedirect('/admin');

        $this->get('/admin/enter?token='.urlencode($plainTextToken))
            ->assertRedirect('/admin/login');

        // SSO tüketimi PAT'yi API istemcisinden düşürmez.
        $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $admin->id]);
    }

    public function test_panel_sso_link_is_single_use(): void
    {
        $admin = User::factory()->create([
            'is_admin' => true,
            'email_verified_at' => now(),
        ]);
        $plainTextToken = $admin->createToken('panel-sso-test')->plainTextToken;

        $this->get('/panel/enter?token='.urlencode($plainTextToken))
            ->assertRedirect('/panel/users');

        $this->get('/panel/enter?token='.urlencode($plainTextToken))
            ->assertRedirect('/panel/login');
    }
}
