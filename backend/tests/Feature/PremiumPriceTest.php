<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Premium yıllık fiyatı artık panelden (Setting: premium_yearly_price, kuruş) yönetilir.
// Gösterilen (/shop/membership-price) ve tahsil edilen (buyMembership) tutar AYNI Setting'ten.
class PremiumPriceTest extends TestCase
{
    use RefreshDatabase;

    public function test_membership_price_endpoint_reflects_setting(): void
    {
        Setting::put('premium_yearly_price', 59900); // 599,00 TL

        $this->getJson('/api/shop/membership-price')
            ->assertOk()
            ->assertExactJson(['yearly_try' => 599]);
    }

    public function test_membership_price_defaults_when_unset(): void
    {
        $this->getJson('/api/shop/membership-price')
            ->assertOk()
            ->assertExactJson(['yearly_try' => 499]); // DEFAULTS: 49900 kuruş
    }

    public function test_buy_membership_charges_panel_price(): void
    {
        Setting::put('premium_yearly_price', 59900);
        $u = User::factory()->create();
        Sanctum::actingAs($u);

        $this->postJson('/api/shop/membership', ['method' => 'card'])
            ->assertOk()
            ->assertJson(['amount' => 59900]);

        $this->assertSame(59900, (int) Payment::first()->amount);
    }
}
