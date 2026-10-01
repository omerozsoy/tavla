<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_weak_password_rejected_on_register(): void
    {
        // 9 karakter -> min:12 ihlali (kucuk+buyuk+rakam olsa bile uzunluk yetmez)
        $this->postJson('/api/register', [
            'first_name' => 'A', 'last_name' => 'B',
            'nickname' => 'zayif', 'email' => 'zayif@e.com', 'password' => 'Secret123',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_strong_password_accepted_on_register(): void
    {
        $this->postJson('/api/register', [
            'first_name' => 'A', 'last_name' => 'B',
            'nickname' => 'guclu', 'email' => 'guclu@e.com', 'password' => 'Secret123456',
        ])->assertStatus(201);
    }

    /** Takma ad: boşluk/noktalama/özel karakter/emoji reddedilir (yalnız harf+rakam). */
    public function test_nickname_rejects_non_alphanumeric_on_register(): void
    {
        foreach (['ad soyad', 'ad.soyad', 'nick!', 'a@b', 'player😀', 'under_score', 'nick-name'] as $bad) {
            $this->postJson('/api/register', [
                'first_name' => 'A', 'last_name' => 'B',
                'nickname' => $bad, 'email' => 'x'.md5($bad).'@e.com', 'password' => 'Secret123456',
            ])->assertStatus(422)->assertJsonValidationErrors('nickname');
        }
    }

    /** Takma ad: harf (TR dahil) + rakam kabul edilir. */
    public function test_nickname_accepts_letters_and_digits(): void
    {
        $this->postJson('/api/register', [
            'first_name' => 'A', 'last_name' => 'B',
            'nickname' => 'çağrıKŞ42', 'email' => 'tr@e.com', 'password' => 'Secret123456',
        ])->assertStatus(201);
    }

    public function test_account_locks_after_five_failed_logins(): void
    {
        // throttle (10/dk) kilit esigine (5) ulasmadan devreye girmesin diye devre disi.
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        User::factory()->create(['email' => 'kilit@e.com', 'password' => Hash::make('DogruSifre123')]);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['login' => 'kilit@e.com', 'password' => 'yanlis'])
                ->assertStatus(422);
        }
        // 6. deneme DOGRU sifreyle bile kilit mesaji almali
        $this->postJson('/api/login', ['login' => 'kilit@e.com', 'password' => 'DogruSifre123'])
            ->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.');
    }
}
