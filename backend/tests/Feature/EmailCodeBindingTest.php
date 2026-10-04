<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-13: e-posta doğrulama kodu adrese bağlı değildi: kendi adresine kod alıp e-postayı başkasınınkine
// çeviren kullanıcı, eski kodla YENİ adresi "doğrulanmış" yapabiliyordu.
class EmailCodeBindingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Mail::fake();
    }

    private function sendCode(User $u): string
    {
        Sanctum::actingAs($u);
        $this->postJson('/api/email/resend')->assertOk()->assertJsonPath('message', 'sent');

        return (string) Cache::get('eotp:'.$u->id)['code'];
    }

    public function test_code_still_verifies_same_email(): void
    {
        $u = User::factory()->unverified()->create(['email' => 'ben@x.test']);
        $code = $this->sendCode($u);
        $this->postJson('/api/email/verify-code', ['code' => $code])->assertOk()->assertJsonPath('message', 'verified');
        $this->assertTrue($u->fresh()->hasVerifiedEmail());
    }

    public function test_code_cannot_verify_email_changed_via_profile(): void
    {
        $u = User::factory()->unverified()->create(['email' => 'ben@x.test']);
        $code = $this->sendCode($u);
        $this->putJson('/api/profile', ['first_name' => 'A', 'last_name' => 'B', 'nickname' => 'benim'.$u->id,
            'email' => 'baskasi@x.test'])->assertOk();
        $this->postJson('/api/email/verify-code', ['code' => $code])->assertStatus(422);
        $this->assertFalse($u->fresh()->hasVerifiedEmail());
    }

    public function test_code_bound_to_email_even_if_changed_elsewhere(): void
    {
        $u = User::factory()->unverified()->create(['email' => 'ben@x.test']);
        $code = $this->sendCode($u);
        User::where('id', $u->id)->update(['email' => 'baskasi@x.test']); // başka bir yoldan değişim
        Sanctum::actingAs($u->fresh());
        $this->postJson('/api/email/verify-code', ['code' => $code])->assertStatus(422);
        $this->assertFalse($u->fresh()->hasVerifiedEmail());
    }
}
