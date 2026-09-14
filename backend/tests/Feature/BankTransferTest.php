<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductOrder;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Havale/EFT ödeme yöntemi: açık/kapalı denetimi + kart yerine IBAN dönmesi + ödemenin
// 'pending' kalıp OTOMATİK fulfill EDİLMEMESİ (admin elle onaylar) + kart uçlarının
// havale ödemesine kapalı olması.
class BankTransferTest extends TestCase
{
    use RefreshDatabase;

    private function enableBank(): void
    {
        Setting::put('bank_transfer_enabled', 1);
        Setting::put('bank_transfer_iban', 'TR000000000000000000000000');
        Setting::put('bank_transfer_name', 'Tavlai A.Ş.');
        Setting::put('bank_transfer_bank', 'Garanti BBVA');
    }

    public function test_bank_info_hidden_when_disabled(): void
    {
        $this->getJson('/api/pay/bank-transfer')->assertOk()->assertExactJson(['enabled' => false]);
    }

    public function test_bank_info_public_when_enabled(): void
    {
        $this->enableBank();
        $this->getJson('/api/pay/bank-transfer')->assertOk()
            ->assertJson(['enabled' => true, 'iban' => 'TR000000000000000000000000', 'bank' => 'Garanti BBVA']);
    }

    public function test_coins_bank_transfer_returns_iban_and_stays_pending(): void
    {
        $this->enableBank();
        $u = User::factory()->create(['coins' => 0]);
        Sanctum::actingAs($u);

        $items = [['id' => array_key_first(config('garanti.coin_packages')), 'qty' => 1]];
        $res = $this->postJson('/api/shop/coins', ['items' => $items, 'method' => 'bank_transfer'])
            ->assertOk()
            ->assertJson(['bankTransfer' => true, 'iban' => 'TR000000000000000000000000']);

        // Kart URL'i DÖNMEZ (havale).
        $this->assertNull($res->json('url'));
        $this->assertNull($res->json('submitUrl'));

        $payment = Payment::first();
        $this->assertSame('coins', $payment->kind);
        $this->assertSame('bank_transfer', $payment->payment_method);
        $this->assertSame('pending', $payment->status);
        $this->assertSame($payment->order_id, $res->json('reference'));
        // Coin OTOMATİK yüklenmez (admin elle verir).
        $this->assertSame(0, (int) $u->fresh()->coins);
    }

    public function test_bank_transfer_rejected_when_disabled(): void
    {
        $u = User::factory()->create();
        Sanctum::actingAs($u);
        $items = [['id' => array_key_first(config('garanti.coin_packages')), 'qty' => 1]];
        $this->postJson('/api/shop/coins', ['items' => $items, 'method' => 'bank_transfer'])
            ->assertStatus(503);
    }

    public function test_money_product_bank_transfer_creates_pending_order(): void
    {
        $this->enableBank();
        $cat = \App\Models\ProductCategory::firstOrCreate(['slug' => 'tavla'], ['name' => 'Tavla']);
        $p = Product::create([
            'name' => 'Ceviz Tavla', 'slug' => 'ceviz-'.uniqid(), 'category_id' => $cat->id,
            'payment_type' => 'money', 'money_price' => 150000, 'stock' => 5, 'published' => true,
        ]);
        $u = User::factory()->create();
        Sanctum::actingAs($u);

        $res = $this->postJson('/api/products/order', [
            'product_id' => $p->id, 'qty' => 1, 'payment_type' => 'money', 'method' => 'bank_transfer',
            'ship_name' => 'Ömer', 'ship_phone' => '5550001122', 'ship_address' => 'Adres', 'ship_city' => 'İstanbul',
        ])->assertOk()->assertJson(['ok' => true, 'kind' => 'money', 'bankTransfer' => true]);

        $order = ProductOrder::first();
        $this->assertSame('pending', $order->status);
        $this->assertSame('bank_transfer', $order->payment_method);
        $this->assertSame(5, (int) $p->fresh()->stock); // stok düşmez (ödeme onaylanmadı)
        $this->assertSame($order->id, $res->json('order_id'));
    }

    public function test_card_page_blocked_for_bank_transfer_payment(): void
    {
        $this->enableBank();
        $u = User::factory()->create();
        $payment = Payment::create([
            'user_id' => $u->id, 'kind' => 'coins', 'payment_method' => 'bank_transfer',
            'order_id' => 'TC-x', 'amount' => 5000, 'coins' => 100, 'currency' => '949', 'status' => 'pending',
        ]);
        // GEÇERLİ imzalı URL bile olsa havale kaydında kart sayfası açılmaz (abort 404).
        $signed = \Illuminate\Support\Facades\URL::temporarySignedRoute('pay.card', now()->addMinutes(30), ['payment' => $payment->id]);
        $this->get($signed)->assertNotFound();
    }
}
