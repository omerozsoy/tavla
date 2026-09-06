<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

// HOŞGELDİN coin'i: KAYITTA verilmez; e-posta DOĞRULAYINCA (veya Google) verilir. Tüm yeni üye 1400.
class WelcomeCoinsTest extends TestCase
{
    use RefreshDatabase;

    public function test_no_coins_at_register_then_granted_on_verify(): void
    {
        config(['game.welcome_coins' => 100]);
        $this->postJson('/api/register', [
            'first_name' => 'Yeni', 'last_name' => 'Uye',
            'nickname' => 'yeniuye', 'email' => 'yeni@e.com', 'password' => 'secret123',
        ])->assertStatus(201);

        $u = User::where('email', 'yeni@e.com')->first();
        $this->assertSame(0, (int) $u->coins, 'KAYITTA coin YOK (doğrulama bekler)');
        $this->assertSame(1400, (int) $u->rating, 'tüm yeni üye 1400');

        // E-posta doğrulama (imzalı link) -> hoşgeldin coin'i.
        $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), [
            'id' => $u->id, 'hash' => sha1($u->getEmailForVerification()),
        ]);
        $this->get($url); // SPA'ya redirect

        $u->refresh();
        $this->assertSame(100, (int) $u->coins, 'doğrulayınca 100 coin');
        $this->assertTrue((bool) $u->welcome_granted);
    }

    public function test_verify_twice_grants_only_once(): void
    {
        config(['game.welcome_coins' => 100]);
        $this->postJson('/api/register', [
            'first_name' => 'Bir', 'last_name' => 'Kez',
            'nickname' => 'birkez', 'email' => 'birkez@e.com', 'password' => 'secret123',
        ])->assertStatus(201);
        $u = User::where('email', 'birkez@e.com')->first();
        $mk = fn () => URL::temporarySignedRoute('verification.verify', now()->addHour(), [
            'id' => $u->id, 'hash' => sha1($u->getEmailForVerification()),
        ]);
        $this->get($mk());
        $this->get($mk()); // ikinci kez -> tekrar VERMEMELİ (zaten doğrulanmış + welcome_granted)

        $this->assertSame(100, (int) $u->fresh()->coins, 'ikinci doğrulama coin EKLEMEZ');
    }

    public function test_all_new_users_rating_1400_selection_removed(): void
    {
        // start_rating kaldırıldı -> gönderilse bile yok sayılır, herkes 1400.
        $this->postJson('/api/register', [
            'first_name' => 'A', 'last_name' => 'B',
            'nickname' => 'usta', 'email' => 'usta@e.com', 'password' => 'secret123',
            'start_rating' => 1700,
        ])->assertStatus(201);

        $this->assertSame(1400, (int) User::where('email', 'usta@e.com')->value('rating'));
    }
}
