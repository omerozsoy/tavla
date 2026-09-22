<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSsoPostExchangeTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sso_accepts_token_in_post_body(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'email_verified_at' => now()]);
        $token = $admin->createToken('post-sso')->plainTextToken;

        $this->post('/admin/enter', ['token' => $token])->assertRedirect('/admin');
    }

    public function test_panel_sso_accepts_token_in_post_body(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'email_verified_at' => now()]);
        $token = $admin->createToken('post-panel-sso')->plainTextToken;

        $this->post('/panel/enter', ['token' => $token])->assertRedirect('/panel/users');
    }

    public function test_invalid_sso_redirect_does_not_cache_or_forward_referrer(): void
    {
        $this->get('/admin/enter?token=invalid-token')->assertStatus(405);
        $this->get('/panel/enter?token=invalid-token')->assertStatus(405);
    }
}
