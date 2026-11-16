<?php

namespace Tests\Feature;

use App\Http\Controllers\PaymentController;
use App\Models\Payment;
use App\Models\User;
use App\Support\Shopier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Shopier hosted ödeme: imza doğrulama (callback round-trip), atomik settle + fulfill, idempotency.
class ShopierTest extends TestCase
{
    use RefreshDatabase;

    private function enableShopier(): void
    {
        config()->set('services.shopier.api_key', 'test_key');
        config()->set('services.shopier.api_secret', 'test_secret');
    }

    private function coinPayment(User $u, string $order): Payment
    {
        return Payment::create([
            'user_id' => $u->id, 'kind' => 'coins', 'order_id' => $order, 'amount' => 20000,
            'coins' => 500, 'package_id' => 'kesex1', 'currency' => '949', 'status' => 'pending',
        ]);
    }

    public function test_enabled_reflects_config(): void
    {
        config()->set('services.shopier.api_key', '');
        config()->set('services.shopier.api_secret', '');
        $this->assertFalse(Shopier::enabled());

        $this->enableShopier();
        $this->assertTrue(Shopier::enabled());
    }

    public function test_callback_signature_round_trip(): void
    {
        $this->enableShopier();
        $sig = base64_encode(hash_hmac('sha256', '123456'.'TC1ABC', 'test_secret', true));

        $this->assertTrue(Shopier::verifyCallback([
            'random_nr' => '123456', 'platform_order_id' => 'TC1ABC', 'signature' => $sig,
        ]));
        $this->assertFalse(Shopier::verifyCallback([
            'random_nr' => '123456', 'platform_order_id' => 'TC1ABC', 'signature' => 'bogus',
        ]));
    }

    public function test_settle_credits_coins_and_is_idempotent(): void
    {
        $u = User::factory()->create(['coins' => 0]);
        $p = $this->coinPayment($u, 'TC2');

        $this->assertTrue(app(PaymentController::class)->settle($p, 'shopier:1'));
        $this->assertSame('paid', $p->fresh()->status);
        $this->assertSame(500, (int) $u->fresh()->coins);

        // Çift callback: ikinci settle hiçbir şey yapmaz (idempotent) -> coin iki kez verilmez.
        $this->assertFalse(app(PaymentController::class)->settle($p, 'shopier:1'));
        $this->assertSame(500, (int) $u->fresh()->coins);
    }

    public function test_callback_endpoint_rejects_bad_signature(): void
    {
        $this->enableShopier();
        $u = User::factory()->create(['coins' => 0]);
        $p = $this->coinPayment($u, 'TC3');

        $this->post('/api/pay/shopier/callback', [
            'platform_order_id' => 'TC3', 'random_nr' => '111', 'status' => 'success', 'signature' => 'bad',
        ]);

        $this->assertSame('pending', $p->fresh()->status);
        $this->assertSame(0, (int) $u->fresh()->coins);
    }

    public function test_callback_endpoint_fulfills_on_valid_success(): void
    {
        $this->enableShopier();
        $u = User::factory()->create(['coins' => 0]);
        $p = $this->coinPayment($u, 'TC4');
        $sig = base64_encode(hash_hmac('sha256', '222'.'TC4', 'test_secret', true));

        $this->post('/api/pay/shopier/callback', [
            'platform_order_id' => 'TC4', 'random_nr' => '222', 'status' => 'success',
            'payment_id' => '9999', 'signature' => $sig,
        ]);

        $this->assertSame('paid', $p->fresh()->status);
        $this->assertSame(500, (int) $u->fresh()->coins);
    }
}
