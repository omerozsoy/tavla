<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSsoReplayTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sso_query_token_is_not_accepted(): void
    {
        $admin = User::factory()->create([
            'is_admin' => true,
            'email_verified_at' => now(),
        ]);
        $plainTextToken = $admin->createToken('sso-test')->plainTextToken;

        $this->get('/admin/enter?token='.urlencode($plainTextToken))->assertStatus(405);
        $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $admin->id]);
    }

    public function test_panel_sso_query_token_is_not_accepted(): void
    {
        $admin = User::factory()->create([
            'is_admin' => true,
            'email_verified_at' => now(),
        ]);
        $plainTextToken = $admin->createToken('panel-sso-test')->plainTextToken;

        $this->get('/panel/enter?token='.urlencode($plainTextToken))->assertStatus(405);
    }
}
