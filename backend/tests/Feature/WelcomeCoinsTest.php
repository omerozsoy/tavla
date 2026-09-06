<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Yeni üye HOŞGELDİN coin'i (game.welcome_coins) + varsayılan rating 1400 ile başlar.
class WelcomeCoinsTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_grants_welcome_coins_and_default_rating(): void
    {
        config(['game.welcome_coins' => 100]);
        $this->postJson('/api/register', [
            'first_name' => 'Yeni', 'last_name' => 'Uye',
            'nickname' => 'yeniuye', 'email' => 'yeni@e.com', 'password' => 'secret123',
        ])->assertStatus(201);

        $u = User::where('email', 'yeni@e.com')->first();
        $this->assertNotNull($u);
        $this->assertSame(100, (int) $u->coins, 'yeni üye 100 hoşgeldin coin almalı');
        $this->assertSame(1400, (int) $u->rating, 'start_rating seçilmezse varsayılan 1400');
    }

    public function test_register_respects_chosen_start_rating(): void
    {
        // E-posta kaydında oyuncu seviyesini seçer (900/1100/1400/1700). Hepsi 1400 DEĞİL.
        $this->postJson('/api/register', [
            'first_name' => 'Us', 'last_name' => 'Ta',
            'nickname' => 'usta', 'email' => 'usta@e.com', 'password' => 'secret123',
            'start_rating' => 1700,
        ])->assertStatus(201);

        $this->assertSame(1700, (int) User::where('email', 'usta@e.com')->value('rating'));
    }
}
