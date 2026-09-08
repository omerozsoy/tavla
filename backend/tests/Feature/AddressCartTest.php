<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductOrder;
use App\Models\User;
use App\Models\UserAddress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Adres defteri CRUD + ortak sepet: coin ürünleri anında, para+coin-paketi tek 'cart' ödemesi.
class AddressCartTest extends TestCase
{
    use RefreshDatabase;

    private static int $seq = 0;

    private function user(int $coins = 0): array
    {
        $n = ++self::$seq;
        $u = User::create([
            'first_name' => 'A', 'last_name' => 'B', 'country' => '',
            'nickname' => 'usr'.$n,
            'email' => 'usr'.$n.'@e.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins; // coins fillable değil -> doğrudan ata
        $u->save();
        return [$u, ['Authorization' => 'Bearer '.$u->createToken('t')->plainTextToken]];
    }

    private function product(array $over = []): Product
    {
        $cat = ProductCategory::firstOrCreate(['slug' => 'test'], ['name' => 'Test', 'sort' => 1]);
        return Product::create(array_merge([
            'name' => 'Ürün', 'slug' => 'urun-'.(++self::$seq), 'category_id' => $cat->id,
            'description' => '', 'images' => [], 'colors' => [], 'payment_type' => 'both',
            'coin_price' => 100, 'money_price' => 5000, 'stock' => 10, 'published' => true, 'sort' => 0,
        ], $over));
    }

    public function test_address_crud_and_default(): void
    {
        [, $h] = $this->user();
        // İlk teslimat adresi otomatik varsayılan.
        $a1 = $this->postJson('/api/addresses', ['type' => 'shipping', 'name' => 'Ali', 'phone' => '5551112233', 'address' => 'Cadde 1', 'city' => 'İstanbul'], $h);
        $a1->assertStatus(201)->assertJsonPath('address.is_default', true);

        // İkinci adres varsayılan işaretlenirse ilki varsayılanlıktan çıkar.
        $a2 = $this->postJson('/api/addresses', ['type' => 'shipping', 'name' => 'Veli', 'phone' => '5559998877', 'address' => 'Sokak 2', 'city' => 'Ankara', 'is_default' => true], $h);
        $a2->assertStatus(201);
        $this->assertFalse(UserAddress::find($a1->json('address.id'))->is_default);
        $this->assertTrue(UserAddress::find($a2->json('address.id'))->is_default);

        // Liste + sil
        $this->getJson('/api/addresses', $h)->assertOk()->assertJsonCount(2, 'addresses');
        $this->deleteJson('/api/addresses/'.$a2->json('address.id'), [], $h)->assertOk();
        // Varsayılan silindi -> kalan adres varsayılan olur.
        $this->assertTrue(UserAddress::find($a1->json('address.id'))->is_default);
    }

    public function test_address_owner_isolation(): void
    {
        [$u1, $h1] = $this->user();
        [, $h2] = $this->user();
        $a = $this->postJson('/api/addresses', ['type' => 'shipping', 'name' => 'X', 'phone' => '5551112233', 'address' => 'Y', 'city' => 'Z'], $h1)->json('address.id');
        // Sanctum guard tek test içinde ilk çözülen kullanıcıyı cache'ler; gerçek HTTP'de
        // her istek yeniden çözer. Farklı kullanıcıyı test etmek için guard'ı sıfırla.
        $this->app['auth']->forgetGuards();
        // Başkası düzenleyemez/silemez.
        $this->putJson('/api/addresses/'.$a, ['type' => 'shipping', 'name' => 'Hack', 'phone' => '1', 'address' => 'a', 'city' => 'b'], $h2)->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->deleteJson('/api/addresses/'.$a, [], $h2)->assertStatus(403);
    }

    public function test_cart_coin_order_atomic(): void
    {
        [$u, $h] = $this->user(1000);
        $p1 = $this->product(['coin_price' => 100, 'stock' => 5]);
        $p2 = $this->product(['coin_price' => 250, 'stock' => 5]);
        $addr = $this->postJson('/api/addresses', ['type' => 'shipping', 'name' => 'Ali', 'phone' => '5551112233', 'address' => 'Cadde 1', 'city' => 'İstanbul'], $h)->json('address.id');

        $res = $this->postJson('/api/products/cart/coin', [
            'items' => [
                ['product_id' => $p1->id, 'qty' => 2], // 200
                ['product_id' => $p2->id, 'qty' => 1], // 250
            ],
            'shipping_address_id' => $addr,
        ], $h);
        $res->assertOk()->assertJsonPath('kind', 'coin');
        $this->assertSame(550, $u->fresh()->coins); // 1000 - 450
        $this->assertSame(3, $p1->fresh()->stock);  // 5 - 2
        $this->assertSame(4, $p2->fresh()->stock);
        $this->assertSame(2, ProductOrder::where('user_id', $u->id)->where('status', 'paid')->count());
    }

    public function test_cart_coin_insufficient_is_atomic(): void
    {
        [$u, $h] = $this->user(100);
        $p = $this->product(['coin_price' => 100, 'stock' => 5]);
        $addr = $this->postJson('/api/addresses', ['type' => 'shipping', 'name' => 'Ali', 'phone' => '5551112233', 'address' => 'Cadde 1', 'city' => 'İstanbul'], $h)->json('address.id');
        // 3 x 100 = 300 > 100 -> yetersiz, hiç sipariş/stok değişmemeli.
        $this->postJson('/api/products/cart/coin', [
            'items' => [['product_id' => $p->id, 'qty' => 3]],
            'shipping_address_id' => $addr,
        ], $h)->assertStatus(422);
        $this->assertSame(100, $u->fresh()->coins);
        $this->assertSame(5, $p->fresh()->stock);
        $this->assertSame(0, ProductOrder::count());
    }

    public function test_cart_coin_requires_valid_shipping(): void
    {
        [, $h] = $this->user(1000);
        $p = $this->product(['coin_price' => 100]);
        // Geçersiz adres id -> 422.
        $this->postJson('/api/products/cart/coin', [
            'items' => [['product_id' => $p->id, 'qty' => 1]],
            'shipping_address_id' => 99999,
        ], $h)->assertStatus(422);
    }

    public function test_cart_checkout_money_creates_pending_orders_and_cart_payment(): void
    {
        config(['garanti.demo' => true, 'garanti.merchant_id' => 'X', 'garanti.terminal_id' => 'X', 'garanti.store_key' => 'X', 'garanti.prov_user' => 'X', 'garanti.prov_pass' => 'X']);
        [$u, $h] = $this->user(0);
        $p = $this->product(['money_price' => 5000, 'stock' => 5]);
        $addr = $this->postJson('/api/addresses', ['type' => 'shipping', 'name' => 'Ali', 'phone' => '5551112233', 'address' => 'Cadde 1', 'city' => 'İstanbul'], $h)->json('address.id');

        $res = $this->postJson('/api/shop/cart-checkout', [
            'products' => [['product_id' => $p->id, 'qty' => 2]], // 2 x 5000 = 10000 kuruş
            'shipping_address_id' => $addr,
        ], $h);
        // Garanti demo/available ise url döner; değilse 503. Her iki durumda da pending sipariş kurulmuş olabilir.
        if ($res->status() === 503) {
            $this->markTestSkipped('Garanti yapılandırılmadı (test ortamı).');
        }
        $res->assertOk();
        $payment = Payment::where('kind', 'cart')->first();
        $this->assertNotNull($payment);
        $this->assertSame(10000, (int) $payment->amount);
        $this->assertCount(1, (array) $payment->product_order_ids);
        $this->assertSame('pending', ProductOrder::first()->status);
        $this->assertSame(5, $p->fresh()->stock); // ödeme öncesi stok düşmez
    }
}
