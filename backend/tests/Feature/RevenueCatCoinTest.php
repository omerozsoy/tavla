<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Support\RevenueCat;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Tüketilir coin paketi (Play Billing / RevenueCat) kredilendirme — SUNUCU-OTORİTER + idempotent.
 */
class RevenueCatCoinTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.revenuecat.secret_key' => 'sk_test',
            'services.revenuecat.coin_products' => ['coin_kese' => 5000],
        ]);
    }

    private function fakeNonSub(string $product, string $txId): void
    {
        Http::fake([
            'api.revenuecat.com/*' => Http::response([
                'subscriber' => [
                    'entitlements' => [],
                    'non_subscriptions' => [
                        $product => [
                            ['id' => $txId, 'store' => 'play_store', 'purchase_date' => '2026-11-13T00:00:00Z', 'price' => ['amount' => 199.99, 'currency' => 'TRY']],
                        ],
                    ],
                ],
            ], 200),
        ]);
    }

    public function test_coin_purchase_credits_wallet_once_and_is_idempotent(): void
    {
        $u = User::factory()->create(['coins' => 0]);
        $this->fakeNonSub('coin_kese', 'TX123');

        $granted = RevenueCat::fulfillCoins($u);
        $this->assertSame(5000, $granted);
        $this->assertSame(5000, (int) $u->fresh()->coins);

        // Admin görünürlüğü: "Ödemeler"e (Payment) tek sipariş yazıldı.
        $this->assertDatabaseHas('payments', [
            'order_id' => 'iap_TX123',
            'user_id' => $u->id,
            'kind' => 'coins',
            'coins' => 5000,
            'payment_method' => 'google_play',
            'status' => 'paid',
            'amount' => 19999, // RC gerçek ödenen 199.99 TRY -> kuruş
        ]);

        // Aynı transaction ikinci kez görülse de (sync + webhook) coin TEKRAR verilmez + sipariş çift olmaz.
        $again = RevenueCat::fulfillCoins($u->fresh());
        $this->assertSame(0, $again);
        $this->assertSame(5000, (int) $u->fresh()->coins);
        $this->assertSame(1, Payment::query()->where('order_id', 'iap_TX123')->count());
    }

    public function test_unknown_product_grants_nothing(): void
    {
        $u = User::factory()->create(['coins' => 0]);
        $this->fakeNonSub('coin_hacker', 'TX999'); // config haritasında yok

        $this->assertSame(0, RevenueCat::fulfillCoins($u));
        $this->assertSame(0, (int) $u->fresh()->coins);
    }

    public function test_no_secret_key_is_noop(): void
    {
        config(['services.revenuecat.secret_key' => '']);
        $u = User::factory()->create(['coins' => 0]);
        $this->fakeNonSub('coin_kese', 'TX1');

        $this->assertSame(0, RevenueCat::fulfillCoins($u));
        $this->assertSame(0, (int) $u->fresh()->coins);
    }
}
