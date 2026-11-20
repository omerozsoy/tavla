<?php

namespace Tests\Feature;

use App\Http\Controllers\PaymentController;
use App\Models\Payment;
use App\Models\User;
use App\Support\Shopier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Shopier REST API v1 (PAT): ürün oluşturma+yönlendirme, webhook imza doğrulama, sipariş re-read,
// atomik settle + fulfill, idempotency. Shopier API Http::fake ile mock'lanır (ağa çıkılmaz).
class ShopierTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'wh_test_token';

    private function enableShopier(): void
    {
        config()->set('services.shopier.pat', 'pat_test');
        config()->set('services.shopier.webhook_token', self::TOKEN);
    }

    private function coinPayment(User $u, string $order, ?string $productId = null): Payment
    {
        return Payment::create([
            'user_id' => $u->id, 'kind' => 'coins', 'order_id' => $order, 'amount' => 20000,
            'coins' => 500, 'package_id' => 'kesex1', 'currency' => '949', 'status' => 'pending',
            'shopier_product_id' => $productId,
        ]);
    }

    public function test_enabled_reflects_pat_config(): void
    {
        config()->set('services.shopier.pat', '');
        $this->assertFalse(Shopier::enabled());

        config()->set('services.shopier.pat', 'pat_test');
        $this->assertTrue(Shopier::enabled());
    }

    public function test_verify_webhook_accepts_valid_and_rejects_bad(): void
    {
        $this->enableShopier();
        $raw = '{"orderId":"ord_1"}';

        $hex = bin2hex(hash_hmac('sha256', $raw, self::TOKEN, true));
        $b64 = base64_encode(hash_hmac('sha256', $raw, self::TOKEN, true));
        $this->assertTrue(Shopier::verifyWebhook($raw, $hex));
        $this->assertTrue(Shopier::verifyWebhook($raw, 'sha256='.$hex));
        $this->assertTrue(Shopier::verifyWebhook($raw, $b64));
        $this->assertFalse(Shopier::verifyWebhook($raw, 'bogus'));
        $this->assertFalse(Shopier::verifyWebhook($raw, '')); // boş imza reddedilir
    }

    public function test_redirect_creates_product_and_redirects_to_shopier(): void
    {
        $this->enableShopier();
        Http::fake(['*/products' => Http::response(['data' => ['id' => 'prod_9', 'url' => 'https://pay.shopier.test/prod_9']], 200)]);
        $u = User::factory()->create();
        $p = $this->coinPayment($u, 'TC1');

        $this->get('/pay/shopier/TC1')->assertRedirect('https://pay.shopier.test/prod_9');

        $p->refresh();
        $this->assertSame('prod_9', $p->shopier_product_id);
        $this->assertSame('https://pay.shopier.test/prod_9', $p->shopier_url);
    }

    public function test_redirect_reuses_stored_url_without_second_product_call(): void
    {
        $this->enableShopier();
        Http::fake(['*/products' => Http::response([], 500)]); // çağrılırsa test kırılır
        $u = User::factory()->create();
        $p = $this->coinPayment($u, 'TC2');
        $p->update(['shopier_product_id' => 'prod_x', 'shopier_url' => 'https://pay.shopier.test/prod_x']);

        $this->get('/pay/shopier/TC2')->assertRedirect('https://pay.shopier.test/prod_x');
        Http::assertNothingSent();
    }

    public function test_settle_credits_coins_and_is_idempotent(): void
    {
        $u = User::factory()->create(['coins' => 0]);
        $p = $this->coinPayment($u, 'TC3');

        $this->assertTrue(app(PaymentController::class)->settle($p, 'shopier:order:ord_3'));
        $this->assertSame('paid', $p->fresh()->status);
        $this->assertSame(500, (int) $u->fresh()->coins);

        // Çift webhook: ikinci settle hiçbir şey yapmaz (idempotent) -> coin iki kez verilmez.
        $this->assertFalse(app(PaymentController::class)->settle($p, 'shopier:order:ord_3'));
        $this->assertSame(500, (int) $u->fresh()->coins);
    }

    public function test_webhook_rejects_bad_signature(): void
    {
        $this->enableShopier();
        $u = User::factory()->create(['coins' => 0]);
        $p = $this->coinPayment($u, 'TC4', 'prod_4');

        $this->call('POST', '/api/pay/shopier/callback', [], [], [], [
            'HTTP_SHOPIER_SIGNATURE' => 'bad', 'CONTENT_TYPE' => 'application/json',
        ], '{"orderId":"ord_4"}')->assertStatus(403);

        $this->assertSame('pending', $p->fresh()->status);
        $this->assertSame(0, (int) $u->fresh()->coins);
    }

    public function test_webhook_fulfills_on_valid_paid_order(): void
    {
        $this->enableShopier();
        Http::fake(['*/orders/ord_5' => Http::response([
            'data' => ['paymentStatus' => 'paid', 'items' => [['productId' => 'prod_5']]],
        ], 200)]);
        $u = User::factory()->create(['coins' => 0]);
        $p = $this->coinPayment($u, 'TC5', 'prod_5');

        $raw = '{"orderId":"ord_5"}';
        $sig = bin2hex(hash_hmac('sha256', $raw, self::TOKEN, true));
        $this->call('POST', '/api/pay/shopier/callback', [], [], [], [
            'HTTP_SHOPIER_SIGNATURE' => $sig, 'CONTENT_TYPE' => 'application/json',
        ], $raw)->assertOk();

        $this->assertSame('paid', $p->fresh()->status);
        $this->assertSame(500, (int) $u->fresh()->coins);
    }

    public function test_reconcile_settles_paid_order_without_webhook(): void
    {
        $this->enableShopier();
        // Shopier sipariş listesi: ödenmiş sipariş, lineItems.productId pending Payment ile eşleşir.
        Http::fake(['*/orders*' => Http::response([
            ['id' => 'ord_r', 'paymentStatus' => 'paid', 'lineItems' => [['productId' => 'prod_r']]],
            ['id' => 'ord_unpaid', 'paymentStatus' => 'pending', 'lineItems' => [['productId' => 'prod_u']]],
        ], 200)]);
        $u = User::factory()->create(['coins' => 0]);
        $p = $this->coinPayment($u, 'TC7', 'prod_r');

        $this->artisan('shopier:reconcile')->assertSuccessful();

        $this->assertSame('paid', $p->fresh()->status);
        $this->assertSame(500, (int) $u->fresh()->coins);
    }

    public function test_webhook_ignores_unpaid_order(): void
    {
        $this->enableShopier();
        Http::fake(['*/orders/ord_6' => Http::response([
            'data' => ['paymentStatus' => 'pending', 'items' => [['productId' => 'prod_6']]],
        ], 200)]);
        $u = User::factory()->create(['coins' => 0]);
        $p = $this->coinPayment($u, 'TC6', 'prod_6');

        $raw = '{"orderId":"ord_6"}';
        $sig = bin2hex(hash_hmac('sha256', $raw, self::TOKEN, true));
        $this->call('POST', '/api/pay/shopier/callback', [], [], [], [
            'HTTP_SHOPIER_SIGNATURE' => $sig, 'CONTENT_TYPE' => 'application/json',
        ], $raw)->assertOk();

        $this->assertSame('pending', $p->fresh()->status);
        $this->assertSame(0, (int) $u->fresh()->coins);
    }
}
