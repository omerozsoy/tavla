<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class TokenSlidingExpiryTest extends TestCase
{
    use RefreshDatabase;

    private function bearer(User $u, \DateTimeInterface $expiresAt): string
    {
        return $u->createToken('web', ['*'], $expiresAt)->plainTextToken;
    }

    public function test_expired_token_is_rejected(): void
    {
        $u = User::factory()->create();
        $plain = $this->bearer($u, now()->subDay()); // süresi geçmiş

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/me')
            ->assertStatus(401);
    }

    public function test_active_request_slides_expiry_forward(): void
    {
        $u = User::factory()->create();
        // Yakın son-kullanma (2 gün) -> eşik (idle-1=29 gün) altında -> tazelenmeli.
        $plain = $this->bearer($u, now()->addDays(2));
        $id = PersonalAccessToken::findToken($plain)->id;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/me')
            ->assertOk();

        $after = PersonalAccessToken::find($id);
        $this->assertTrue(
            $after->expires_at->gt(now()->addDays(28)),
            'Aktif istekte expires_at ~30 güne ileri kaymalı'
        );
    }

    public function test_fresh_token_not_rewritten_each_request(): void
    {
        $u = User::factory()->create();
        $plain = $this->bearer($u, now()->addDays(30)); // taze -> eşik üstü
        $tok = PersonalAccessToken::findToken($plain);
        $before = $tok->expires_at->copy();

        $this->withHeader('Authorization', 'Bearer '.$plain)->getJson('/api/me')->assertOk();

        $after = PersonalAccessToken::find($tok->id)->expires_at;
        // Eşik üstü olduğu için DB'ye yeniden yazılmamalı (dakikalık fark yok).
        $this->assertEquals($before->timestamp, $after->timestamp, 'Taze token her istekte yeniden yazılmamalı');
    }
}
