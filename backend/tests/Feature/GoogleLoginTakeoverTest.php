<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

// A-11: saldırgan kurbanın e-postasıyla (doğrulamadan) hesap açar; kurban sonra Google ile girince
// saldırganın hesabına girer ve saldırganın şifresi/oturumu geçerli kalırdı.
class GoogleLoginTakeoverTest extends TestCase
{
    use RefreshDatabase;

    private function fakeGoogle(string $email): void
    {
        config(['services.google.client_id' => 'cid']);
        Http::fake(['oauth2.googleapis.com/*' => Http::response([
            'aud' => 'cid', 'iss' => 'https://accounts.google.com', 'email' => $email, 'email_verified' => 'true',
        ], 200)]);
    }

    public function test_linking_unverified_account_revokes_previous_password_and_tokens(): void
    {
        $attacker = User::factory()->unverified()->create(['email' => 'kurban@gmail.com', 'password' => Hash::make('saldirgan-sifre')]);
        $oldToken = $attacker->createToken('attacker')->plainTextToken;

        $this->fakeGoogle('kurban@gmail.com');
        $this->postJson('/api/auth/google', ['credential' => 'x'])->assertOk();

        $u = $attacker->fresh();
        $this->assertTrue($u->hasVerifiedEmail());
        $this->assertFalse(Hash::check('saldirgan-sifre', $u->password), 'önceki şifre geçersiz kalmalı');
        // Önceki token iptal: yalnız Google girişinde verilen yeni token kalmalı.
        $this->assertSame(1, $u->tokens()->count());
        $this->assertNull(PersonalAccessToken::findToken($oldToken));
    }

    public function test_verified_account_google_login_keeps_password(): void
    {
        $u = User::factory()->create(['email' => 'sahip@gmail.com', 'password' => Hash::make('benim-sifrem')]);
        $this->fakeGoogle('sahip@gmail.com');
        $this->postJson('/api/auth/google', ['credential' => 'x'])->assertOk();
        $this->assertTrue(Hash::check('benim-sifrem', $u->fresh()->password));
    }

    // iOS native: GoogleSignIn-iOS idToken'in aud'sini iOS client ID yapar (web DEGIL). Backend bunu da
    // kabul etmeli, yoksa iPhone girisi "Geçersiz istemci" ile reddedilir.
    public function test_ios_client_id_audience_is_accepted(): void
    {
        config(['services.google.client_id' => 'web-cid', 'services.google.ios_client_id' => 'ios-cid']);
        Http::fake(['oauth2.googleapis.com/*' => Http::response([
            'aud' => 'ios-cid', 'iss' => 'https://accounts.google.com',
            'email' => 'iphone@gmail.com', 'email_verified' => 'true',
        ], 200)]);
        $this->postJson('/api/auth/google', ['credential' => 'x'])->assertOk();
        $this->assertDatabaseHas('users', ['email' => 'iphone@gmail.com']);
    }

    public function test_unknown_audience_is_rejected(): void
    {
        config(['services.google.client_id' => 'web-cid', 'services.google.ios_client_id' => 'ios-cid']);
        Http::fake(['oauth2.googleapis.com/*' => Http::response([
            'aud' => 'baska-app-cid', 'iss' => 'https://accounts.google.com',
            'email' => 'saldirgan@gmail.com', 'email_verified' => 'true',
        ], 200)]);
        $this->postJson('/api/auth/google', ['credential' => 'x'])->assertStatus(401);
    }
}
