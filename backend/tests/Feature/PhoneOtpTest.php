<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PhoneOtpTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $attr = []): User
    {
        return User::factory()->create(array_merge([
            'phone' => '05321112233',
            'phone_verified_at' => null,
        ], $attr));
    }

    public function test_send_then_verify_marks_phone_verified(): void
    {
        $u = $this->user();
        Sanctum::actingAs($u);

        $this->postJson('/api/phone/send-otp')->assertOk()->assertJson(['message' => 'sent']);

        $rec = Cache::get('otp:'.$u->id);
        $this->assertNotNull($rec, 'OTP cache yazilmali');

        $this->postJson('/api/phone/verify-otp', ['code' => $rec['code']])
            ->assertOk()->assertJson(['message' => 'verified']);

        $this->assertNotNull($u->fresh()->phone_verified_at);
        $this->assertNull(Cache::get('otp:'.$u->id), 'Dogrulamadan sonra kod silinmeli');
    }

    public function test_wrong_code_rejected_and_not_verified(): void
    {
        $u = $this->user();
        Sanctum::actingAs($u);
        $this->postJson('/api/phone/send-otp')->assertOk();
        $real = Cache::get('otp:'.$u->id)['code'];
        $wrong = $real === '000000' ? '111111' : '000000';

        $this->postJson('/api/phone/verify-otp', ['code' => $wrong])
            ->assertStatus(422)->assertJson(['message' => 'wrong']);
        $this->assertNull($u->fresh()->phone_verified_at);
    }

    public function test_no_phone_cannot_send(): void
    {
        $u = $this->user(['phone' => null]);
        Sanctum::actingAs($u);
        $this->postJson('/api/phone/send-otp')->assertStatus(422)->assertJson(['message' => 'no_phone']);
    }

    public function test_expired_or_missing_code_rejected(): void
    {
        $u = $this->user();
        Sanctum::actingAs($u);
        // Hic kod gonderilmeden dogrulama denemesi -> expired
        $this->postJson('/api/phone/verify-otp', ['code' => '123456'])
            ->assertStatus(422)->assertJson(['message' => 'expired']);
    }
}
