<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\PromoCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// INDIRIM (promo) KODU: coin sepeti odemesinde SUNUCU-OTORITER indirim.
// Tutarlar KURUS (TL x100). 'baslangic' paketi config'te 10000 kurus (100 TL) / 100 coin.
class PromoCodeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['garanti.demo' => true]); // odeme "available" (demo) -> buyCoins calisir
    }

    private function user(): User
    {
        $u = User::create([
            'first_name' => 'Promo', 'last_name' => 'T', 'country' => '',
            'nickname' => 'promo', 'email' => 'promo@e.com', 'password' => bcrypt('secret123'),
        ]);
        Sanctum::actingAs($u);

        return $u;
    }

    private const CART = ['items' => [['id' => 'baslangic', 'qty' => 1]]]; // 10000 kurus

    public function test_validate_percent_discount(): void
    {
        $this->user();
        PromoCode::create(['code' => 'YUZDE20', 'type' => 'percent', 'value' => 20, 'active' => true]);

        $this->postJson('/api/shop/promo/validate', self::CART + ['code' => 'yuzde20'])
            ->assertOk()
            ->assertJsonPath('code', 'YUZDE20')
            ->assertJsonPath('discount', 2000)   // %20 x 10000
            ->assertJsonPath('subtotal', 10000)
            ->assertJsonPath('final', 8000);
    }

    public function test_validate_fixed_discount_in_kurus(): void
    {
        $this->user();
        PromoCode::create(['code' => 'SABIT30', 'type' => 'fixed', 'value' => 3000, 'active' => true]);

        $this->postJson('/api/shop/promo/validate', self::CART + ['code' => 'SABIT30'])
            ->assertOk()
            ->assertJsonPath('discount', 3000)
            ->assertJsonPath('final', 7000);
    }

    public function test_buycoins_applies_discount_to_amount(): void
    {
        $u = $this->user();
        PromoCode::create(['code' => 'HOSGELDIN', 'type' => 'percent', 'value' => 25, 'active' => true]);

        $this->postJson('/api/shop/coins', self::CART + ['code' => 'hosgeldin'])
            ->assertOk()
            ->assertJsonPath('amount', 7500)   // 10000 - %25
            ->assertJsonPath('discount', 2500)
            ->assertJsonPath('coins', 100);    // coin miktari DEGISMEZ

        $p = Payment::where('user_id', $u->id)->first();
        $this->assertSame(7500, (int) $p->amount);
        $this->assertSame(2500, (int) $p->discount_kurus);
        $this->assertSame('HOSGELDIN', $p->discount_code);
        $this->assertSame(100, (int) $p->coins);
    }

    public function test_buycoins_without_code_full_price(): void
    {
        $this->user();
        $this->postJson('/api/shop/coins', self::CART)
            ->assertOk()
            ->assertJsonPath('amount', 10000)
            ->assertJsonPath('discount', 0);
    }

    public function test_invalid_code_rejected(): void
    {
        $this->user();
        $this->postJson('/api/shop/coins', self::CART + ['code' => 'YOKBOYLE'])->assertStatus(422);
        $this->postJson('/api/shop/promo/validate', self::CART + ['code' => 'YOKBOYLE'])->assertStatus(422);
    }

    public function test_min_amount_not_met(): void
    {
        $this->user();
        PromoCode::create(['code' => 'BUYUK', 'type' => 'percent', 'value' => 10, 'min_amount' => 20000, 'active' => true]);
        $this->postJson('/api/shop/promo/validate', self::CART + ['code' => 'BUYUK'])->assertStatus(422);
    }

    public function test_expired_code_rejected(): void
    {
        $this->user();
        PromoCode::create([
            'code' => 'GECMIS', 'type' => 'percent', 'value' => 10, 'active' => true,
            'expires_at' => now()->subDay(),
        ]);
        $this->postJson('/api/shop/promo/validate', self::CART + ['code' => 'GECMIS'])->assertStatus(422);
    }

    public function test_exhausted_code_rejected(): void
    {
        $this->user();
        PromoCode::create([
            'code' => 'BITTI', 'type' => 'percent', 'value' => 10, 'active' => true,
            'max_uses' => 1, 'used_count' => 1,
        ]);
        $this->postJson('/api/shop/promo/validate', self::CART + ['code' => 'BITTI'])->assertStatus(422);
    }

    public function test_inactive_code_rejected(): void
    {
        $this->user();
        PromoCode::create(['code' => 'KAPALI', 'type' => 'percent', 'value' => 10, 'active' => false]);
        $this->postJson('/api/shop/promo/validate', self::CART + ['code' => 'KAPALI'])->assertStatus(422);
    }
}
