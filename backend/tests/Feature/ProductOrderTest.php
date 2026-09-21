<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductOrder;
use App\Models\User;
use App\Services\GarantiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Fiziksel urun magazasi siparis akisi: coin (aninda stok+coin dusumu) ve money
// (Garanti callback fulfill) + stok/renk/odeme-tipi korumalari.
class ProductOrderTest extends TestCase
{
    use RefreshDatabase;

    private function product(array $attrs = []): Product
    {
        $cat = \App\Models\ProductCategory::firstOrCreate(['slug' => 'tavla'], ['name' => 'Tavla']);

        return Product::create(array_merge([
            'name'         => 'Ceviz Tavla',
            'slug'         => 'ceviz-tavla-'.uniqid(),
            'category_id'  => $cat->id,
            'payment_type' => 'both',
            'coin_price'   => 300,
            'money_price'  => 150000, // 1500 TL (kurus)
            'stock'        => 5,
            'published'    => true,
            'colors'       => [['name' => 'Ceviz', 'hex' => '#5a3a22'], ['name' => 'Siyah', 'hex' => '#111111']],
        ], $attrs));
    }

    private function ship(): array
    {
        return [
            'ship_name'    => 'Ömer Özsoy',
            'ship_phone'   => '5551112233',
            'ship_address' => 'Örnek Mah. 1. Sk. No:2',
            'ship_city'    => 'İstanbul',
            'ship_postal'  => '34000',
        ];
    }

    public function test_catalog_lists_only_published(): void
    {
        $this->product();
        $this->product(['published' => false, 'name' => 'Gizli']);

        $res = $this->getJson('/api/products')->assertOk()->json('products');
        $this->assertCount(1, $res);
        $this->assertSame('Ceviz Tavla', $res[0]['name']);
        $this->assertSame('tavla', $res[0]['category']);
        $this->assertSame('Tavla', $res[0]['category_name']);
    }

    public function test_coin_order_deducts_coins_and_stock_and_is_paid(): void
    {
        $u = User::factory()->create(['coins' => 1000]);
        $p = $this->product();
        Sanctum::actingAs($u);

        $this->postJson('/api/products/order', array_merge($this->ship(), [
            'product_id'   => $p->id,
            'qty'          => 2,
            'color'        => 'Siyah',
            'payment_type' => 'coin',
        ]))->assertOk()->assertJson(['ok' => true, 'kind' => 'coin', 'coins' => 400]);

        $this->assertSame(400, (int) $u->fresh()->coins);
        $this->assertSame(3, (int) $p->fresh()->stock);

        $order = ProductOrder::first();
        $this->assertSame('paid', $order->status);
        $this->assertSame(600, (int) $order->coin_cost);
        $this->assertSame('Siyah', $order->color);
    }

    public function test_coin_order_retry_with_same_idempotency_key_is_noop(): void
    {
        $u = User::factory()->create(['coins' => 1000]);
        $p = $this->product();
        Sanctum::actingAs($u);
        $payload = array_merge($this->ship(), [
            'product_id' => $p->id,
            'qty' => 1,
            'color' => 'Ceviz',
            'payment_type' => 'coin',
            'idempotency_key' => '6f7f8c2e-1db8-4d4a-a8ac-30e5c2a9a111',
        ]);

        $this->postJson('/api/products/order', $payload)->assertOk();
        $this->postJson('/api/products/order', $payload)->assertOk();

        $this->assertSame(700, (int) $u->fresh()->coins);
        $this->assertSame(4, (int) $p->fresh()->stock);
        $this->assertSame(1, ProductOrder::count());
    }

    public function test_coin_order_rejected_when_insufficient_coins(): void
    {
        $u = User::factory()->create(['coins' => 100]);
        $p = $this->product();
        Sanctum::actingAs($u);

        $this->postJson('/api/products/order', array_merge($this->ship(), [
            'product_id' => $p->id, 'qty' => 1, 'color' => 'Ceviz', 'payment_type' => 'coin',
        ]))->assertStatus(422);

        $this->assertSame(5, (int) $p->fresh()->stock); // stok dokunulmadi
        $this->assertSame(0, ProductOrder::count());
    }

    public function test_order_rejected_when_out_of_stock(): void
    {
        $u = User::factory()->create(['coins' => 10000]);
        $p = $this->product(['stock' => 1]);
        Sanctum::actingAs($u);

        $this->postJson('/api/products/order', array_merge($this->ship(), [
            'product_id' => $p->id, 'qty' => 2, 'color' => 'Ceviz', 'payment_type' => 'coin',
        ]))->assertStatus(422);
    }

    public function test_invalid_color_rejected(): void
    {
        $u = User::factory()->create(['coins' => 10000]);
        $p = $this->product();
        Sanctum::actingAs($u);

        $this->postJson('/api/products/order', array_merge($this->ship(), [
            'product_id' => $p->id, 'qty' => 1, 'color' => 'Mor', 'payment_type' => 'coin',
        ]))->assertStatus(422);
    }

    public function test_coin_payment_rejected_when_product_money_only(): void
    {
        $u = User::factory()->create(['coins' => 10000]);
        $p = $this->product(['payment_type' => 'money', 'coin_price' => null]);
        Sanctum::actingAs($u);

        $this->postJson('/api/products/order', array_merge($this->ship(), [
            'product_id' => $p->id, 'qty' => 1, 'color' => 'Ceviz', 'payment_type' => 'coin',
        ]))->assertStatus(422);
    }

    public function test_money_order_creates_pending_order_and_payment(): void
    {
        config(['garanti.demo' => true]); // isAvailable + isDemo true
        $u = User::factory()->create();
        $p = $this->product();
        Sanctum::actingAs($u);

        $res = $this->postJson('/api/products/order', array_merge($this->ship(), [
            'product_id' => $p->id, 'qty' => 2, 'color' => 'Ceviz', 'payment_type' => 'money',
        ]))->assertOk()->assertJson(['ok' => true, 'kind' => 'money', 'amount' => 300000]);

        $order = ProductOrder::first();
        $this->assertSame('pending', $order->status);
        $this->assertSame(300000, (int) $order->amount);
        $this->assertNotNull($order->payment_id);
        $this->assertSame(5, (int) $p->fresh()->stock); // odeme oncesi stok dusmez

        $payment = Payment::find($order->payment_id);
        $this->assertSame('product', $payment->kind);
        $this->assertSame($order->id, (int) $payment->product_order_id);
    }

    public function test_money_callback_marks_order_paid_and_decrements_stock(): void
    {
        $u = User::factory()->create();
        $p = $this->product();
        $order = ProductOrder::create(array_merge($this->ship(), [
            'user_id' => $u->id, 'product_id' => $p->id, 'product_name' => $p->name,
            'color' => 'Ceviz', 'qty' => 2, 'payment_type' => 'money', 'amount' => 300000, 'status' => 'pending',
        ]));
        $payment = Payment::create([
            'user_id' => $u->id, 'kind' => 'product', 'order_id' => 'TP-'.$u->id,
            'amount' => 300000, 'product_order_id' => $order->id, 'currency' => '949', 'status' => 'pending',
        ]);
        $order->payment_id = $payment->id;
        $order->save();

        $this->mock(GarantiService::class, function ($m) use ($payment) {
            $m->shouldReceive('verifyCallback')->andReturn([
                'ok' => true, 'hash_ok' => true, 'msg' => 'Onaylandı', 'order_id' => $payment->order_id,
            ]);
        });

        $this->post('/pay/callback', ['txnamount' => '300000'])->assertOk();

        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertSame('paid', $order->fresh()->status);
        $this->assertSame(3, (int) $p->fresh()->stock);
    }

    public function test_my_orders_returns_own_orders(): void
    {
        $u = User::factory()->create(['coins' => 1000]);
        $p = $this->product();
        Sanctum::actingAs($u);
        $this->postJson('/api/products/order', array_merge($this->ship(), [
            'product_id' => $p->id, 'qty' => 1, 'color' => 'Ceviz', 'payment_type' => 'coin',
        ]))->assertOk();

        $orders = $this->getJson('/api/me/orders')->assertOk()->json('orders');
        $this->assertCount(1, $orders);
        $this->assertSame('Ödendi', $orders[0]['status_label']);
    }

    // Coin HAVALE odemeleri "Siparislerim"de bekleyen siparis olarak gorunmeli. İKİ YOL:
    // buyCoins (kind='coins') VE sepet coin paketi (kind='cart', coins>0). Kart aninda biter -> gizli.
    public function test_my_orders_includes_pending_coin_bank_transfer(): void
    {
        $u = User::factory()->create(['coins' => 0]);
        Sanctum::actingAs($u);

        // 1) buyCoins havale (kind=coins) -> gorunmeli
        \App\Models\Payment::create([
            'user_id' => $u->id, 'kind' => 'coins', 'payment_method' => 'bank_transfer',
            'order_id' => 'TCTEST1', 'amount' => 10000, 'coins' => 100, 'currency' => '949', 'status' => 'pending',
        ]);
        // 2) SEPET coin paketi havale (kind=cart, coins>0) -> gorunmeli (asil bug buydu)
        \App\Models\Payment::create([
            'user_id' => $u->id, 'kind' => 'cart', 'payment_method' => 'bank_transfer',
            'order_id' => 'TKTEST1', 'amount' => 20000, 'coins' => 200, 'currency' => '949', 'status' => 'pending',
        ]);
        // 3) Kart ile coin (aninda biter) -> GORUNMEMELI
        \App\Models\Payment::create([
            'user_id' => $u->id, 'kind' => 'coins', 'payment_method' => null,
            'order_id' => 'TCTEST2', 'amount' => 5000, 'coins' => 50, 'currency' => '949', 'status' => 'paid',
        ]);
        // 4) Fiziksel-only sepet havale (coins=0) -> coin satiri GORUNMEMELI (urun ProductOrder'da)
        \App\Models\Payment::create([
            'user_id' => $u->id, 'kind' => 'cart', 'payment_method' => 'bank_transfer',
            'order_id' => 'TKTEST2', 'amount' => 30000, 'coins' => 0, 'currency' => '949', 'status' => 'pending',
        ]);

        $orders = $this->getJson('/api/me/orders')->assertOk()->json('orders');
        $this->assertCount(2, $orders); // buyCoins-havale + sepet-coin-havale
        $names = array_map(fn ($o) => $o['product_name'], $orders);
        $this->assertContains('100 Jeton', $names);
        $this->assertContains('200 Jeton', $names);
        foreach ($orders as $o) {
            $this->assertSame('money', $o['payment_type']);
            $this->assertSame('pending', $o['status']);
            $this->assertSame('Havale onayı bekleniyor', $o['status_label']);
        }
    }
}
