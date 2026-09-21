<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminEmailGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_self_assign_configured_admin_email(): void
    {
        config()->set('services.admin_emails', ['root@example.test']);
        $admin = User::factory()->create([
            'is_admin' => true,
            'email' => 'ordinary-admin@example.test',
            'email_verified_at' => now(),
        ]);
        Sanctum::actingAs($admin);

        $this->putJson('/api/profile', [
            'first_name' => 'Ordinary',
            'last_name' => 'Admin',
            'nickname' => $admin->nickname,
            'email' => 'root@example.test',
        ])->assertStatus(422);

        $this->assertSame('ordinary-admin@example.test', $admin->fresh()->email);
    }
}
