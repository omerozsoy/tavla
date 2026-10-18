<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

// HOŞGELDİN premium'u: yeni üye e-posta DOĞRULAYINCA (veya Google) N ay ücretsiz Premium ('star').
// Bir kez (trial_used); süresi geçerli ücretli planı olanı KISALTMAZ.
class WelcomePremiumTest extends TestCase
{
    use RefreshDatabase;

    private function register(string $email, string $nick): User
    {
        $this->postJson('/api/register', [
            'first_name' => 'Yeni', 'last_name' => 'Uye',
            'country' => 'TR', 'province' => 'İstanbul', 'phone' => '05551234567',
            'nickname' => $nick, 'email' => $email, 'password' => 'Secret123456',
        ])->assertStatus(201);

        return User::where('email', $email)->first();
    }

    private function verifyLink(User $u): string
    {
        return URL::temporarySignedRoute('verification.verify', now()->addHour(), [
            'id' => $u->id, 'hash' => sha1($u->getEmailForVerification()),
        ]);
    }

    public function test_verify_grants_three_months_premium(): void
    {
        config(['game.welcome_premium_months' => 3]);
        $u = $this->register('prem@e.com', 'premuye');

        $this->assertSame('free', $u->plan_active, 'KAYITTA premium YOK');

        $this->get($this->verifyLink($u));
        $u->refresh();

        $this->assertSame('star', $u->plan, 'doğrulayınca Premium (star)');
        $this->assertSame('star', $u->plan_active, 'süresi geçerli premium aktif');
        $this->assertTrue((bool) $u->trial_used, 'trial_used işaretlendi');
        $this->assertNotNull($u->plan_until);
        // ~3 ay ileri (gün toleransı ile)
        $this->assertEqualsWithDelta(now()->addMonths(3)->timestamp, $u->plan_until->timestamp, 60 * 60 * 24 * 2);
    }

    // REGRESYON KİLİDİ: KOD yolu (verifyEmailCode) da LİNK yolu ile BİREBİR aynı ödülü vermeli.
    // 2026-10 bug'ı: kodla doğrulayan hoşgeldin coin+premium ALAMIYORDU (grant'lar unutulmuştu).
    // Artık iki yol da tek completeEmailVerification() çağırır -> bu test bunu kilitler.
    public function test_verify_by_code_also_grants_premium_and_coins(): void
    {
        config(['game.welcome_premium_months' => 3]);
        $u = $this->register('code@e.com', 'codeuye');
        $this->assertSame('free', $u->plan_active, 'KAYITTA premium YOK');

        // E-posta kodu cache'e konur (sendVerification'ın yaptığı gibi): eotp:{id}.
        \Illuminate\Support\Facades\Cache::put('eotp:'.$u->id, [
            'code' => '123456', 'email' => strtolower($u->email), 'tries' => 0,
        ], now()->addMinutes(15));

        \Laravel\Sanctum\Sanctum::actingAs($u, ['*']);
        $this->postJson('/api/email/verify-code', ['code' => '123456'])
            ->assertOk()
            ->assertJson(['message' => 'verified']);

        $u->refresh();
        $this->assertSame('star', $u->plan, 'KODLA doğrulayınca da Premium (star)');
        $this->assertTrue((bool) $u->trial_used, 'trial_used (kod yolu)');
        $this->assertTrue((bool) $u->welcome_granted, 'hoşgeldin coin de verildi (kod yolu)');
    }

    public function test_verify_twice_grants_premium_only_once(): void
    {
        config(['game.welcome_premium_months' => 3]);
        $u = $this->register('once@e.com', 'onceuye');

        $this->get($this->verifyLink($u));
        $first = $u->fresh()->plan_until->timestamp;
        $this->get($this->verifyLink($u)); // ikinci doğrulama premium'u UZATMAMALI

        $this->assertSame($first, $u->fresh()->plan_until->timestamp, 'ikinci doğrulama premium eklemez');
    }

    public function test_disabled_when_months_zero(): void
    {
        config(['game.welcome_premium_months' => 0]);
        $u = $this->register('off@e.com', 'offuye');

        $this->get($this->verifyLink($u));
        $u->refresh();

        $this->assertSame('free', $u->plan_active, 'ayar 0 -> premium verilmez');
        $this->assertFalse((bool) $u->trial_used);
    }
}
