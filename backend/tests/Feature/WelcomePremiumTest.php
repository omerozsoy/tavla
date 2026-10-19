<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

// HOŞGELDİN premium'u (SABİT TARİHLİ, owner kararı 2026-10-19): yeni üye e-posta DOĞRULAYINCA
// (veya Google) 2 Ocak 2027 00:00'a kadar ücretsiz Premium. 31 Aralık 2026'dan SONRA hediye YOK.
// Bir kez (trial_used); süresi geçerli ücretli planı olanı KISALTMAZ.
class WelcomePremiumTest extends TestCase
{
    use RefreshDatabase;

    private const GIFT_UNTIL = '2027-01-02 00:00:00';

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

    public function test_verify_grants_premium_until_fixed_date(): void
    {
        $this->travelTo('2026-11-01 12:00:00'); // hediye dönemi içinde
        $u = $this->register('prem@e.com', 'premuye');

        $this->assertSame('free', $u->plan_active, 'KAYITTA premium YOK');

        $this->get($this->verifyLink($u));
        $u->refresh();

        $this->assertSame('premium', $u->plan, 'doğrulayınca Premium');
        $this->assertSame('premium', $u->plan_active, 'süresi geçerli premium aktif');
        $this->assertTrue((bool) $u->trial_used, 'trial_used işaretlendi');
        $this->assertSame(self::GIFT_UNTIL, $u->plan_until->format('Y-m-d H:i:s'), 'bitiş 2 Ocak 2027 00:00');
    }

    // REGRESYON KİLİDİ: KOD yolu (verifyEmailCode) da LİNK yolu ile BİREBİR aynı ödülü vermeli.
    public function test_verify_by_code_also_grants_premium_and_coins(): void
    {
        $this->travelTo('2026-11-01 12:00:00');
        $u = $this->register('code@e.com', 'codeuye');
        $this->assertSame('free', $u->plan_active, 'KAYITTA premium YOK');

        \Illuminate\Support\Facades\Cache::put('eotp:'.$u->id, [
            'code' => '123456', 'email' => strtolower($u->email), 'tries' => 0,
        ], now()->addMinutes(15));

        \Laravel\Sanctum\Sanctum::actingAs($u, ['*']);
        $this->postJson('/api/email/verify-code', ['code' => '123456'])
            ->assertOk()
            ->assertJson(['message' => 'verified']);

        $u->refresh();
        $this->assertSame('premium', $u->plan, 'KODLA doğrulayınca da Premium');
        $this->assertSame(self::GIFT_UNTIL, $u->plan_until->format('Y-m-d H:i:s'), 'bitiş sabit tarih');
        $this->assertTrue((bool) $u->trial_used, 'trial_used (kod yolu)');
        $this->assertTrue((bool) $u->welcome_granted, 'hoşgeldin coin de verildi (kod yolu)');
    }

    public function test_verify_twice_grants_premium_only_once(): void
    {
        $this->travelTo('2026-11-01 12:00:00');
        $u = $this->register('once@e.com', 'onceuye');

        $this->get($this->verifyLink($u));
        $first = $u->fresh()->plan_until->timestamp;
        $this->get($this->verifyLink($u)); // ikinci doğrulama premium'u UZATMAMALI

        $this->assertSame($first, $u->fresh()->plan_until->timestamp, 'ikinci doğrulama premium eklemez');
    }

    // HEDİYE DÖNEMİ KAPANDIKTAN SONRA (31 Aralık 2026'dan sonra) kayıt olan premium ALMAZ.
    public function test_no_gift_after_cutoff(): void
    {
        $this->travelTo('2027-01-15 12:00:00'); // hediye dönemi bitti
        $u = $this->register('late@e.com', 'lateuye');

        $this->get($this->verifyLink($u));
        $u->refresh();

        $this->assertSame('free', $u->plan_active, 'kesimden sonra premium verilmez');
        $this->assertNull($u->plan_until, 'plan_until atanmaz');
        $this->assertTrue((bool) $u->trial_used, 'trial_used yine işaretlenir (bir kez denendi)');
    }
}
