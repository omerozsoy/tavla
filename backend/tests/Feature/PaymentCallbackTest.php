<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Services\GarantiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Odeme callback TUTAR dogrulamasi (#16): banka txnamount'u kayitli KURUS tutarla
// tam sayi eslesmeli. Uyumsuz -> plan aktive OLMAZ. Bos -> strict bayragina gore.
class PaymentCallbackTest extends TestCase
{
    use RefreshDatabase;

    private function makePayment(int $amount = 200000): Payment
    {
        $u = User::factory()->create(['plan' => 'free']);

        return Payment::create([
            'user_id' => $u->id,
            'order_id' => 'ORD-'.$u->id,
            'plan' => 'star',
            'period' => 'yearly',
            'amount' => $amount,
            'currency' => '949',
            'status' => 'pending',
        ]);
    }

    // Coin (jeton) odemesi plan/period OLMADAN olusabilmeli (1364 hatasi regresyonu).
    public function test_coins_payment_can_be_created_without_plan(): void
    {
        $u = User::factory()->create(['plan' => 'free']);
        $p = Payment::create([
            'user_id' => $u->id,
            'kind' => 'coins',
            'order_id' => 'TC-'.$u->id,
            'amount' => 20000,
            'coins' => 200,
            'package_id' => 'baslangicx2',
            'currency' => '949',
            'status' => 'pending',
        ]);

        $this->assertNull($p->fresh()->plan);
        $this->assertNull($p->fresh()->period);
        $this->assertSame(200, (int) $p->fresh()->coins);
    }

    // Banka hash/3D dogrulamasini onaylanmis kabul et (tutar karari controller'da kalir).
    private function mockBankApproved(string $orderId): void
    {
        $this->mock(GarantiService::class, function ($m) use ($orderId) {
            $m->shouldReceive('verifyCallback')->andReturn([
                'ok' => true,
                'hash_ok' => true,
                'msg' => 'Onaylandı',
                'order_id' => $orderId,
            ]);
        });
    }

    public function test_matching_amount_activates_plan(): void
    {
        $p = $this->makePayment(200000);
        $this->mockBankApproved($p->order_id);

        $this->post('/pay/callback', ['txnamount' => '200000'])->assertOk();

        $this->assertSame('paid', $p->fresh()->status);
        $this->assertSame('star', User::find($p->user_id)->plan);
    }

    public function test_mismatched_amount_is_rejected(): void
    {
        $p = $this->makePayment(200000);
        $this->mockBankApproved($p->order_id);

        // Banka daha dusuk tutar bildirdi -> plan aktive OLMAMALI.
        $this->post('/pay/callback', ['txnamount' => '100000'])->assertOk();

        $this->assertSame('failed', $p->fresh()->status);
        $this->assertSame('free', User::find($p->user_id)->plan);
    }

    public function test_decimal_format_variant_still_matches(): void
    {
        $p = $this->makePayment(200000);
        $this->mockBankApproved($p->order_id);

        // Ayni tutar farkli ondalik formatta ("200000.00") -> yine eslesmeli.
        $this->post('/pay/callback', ['txnamount' => '200000.00'])->assertOk();

        $this->assertSame('paid', $p->fresh()->status);
    }

    public function test_empty_amount_passes_when_not_strict(): void
    {
        config(['garanti.strict_amount' => false]);
        $p = $this->makePayment(200000);
        $this->mockBankApproved($p->order_id);

        $this->post('/pay/callback', [])->assertOk(); // txnamount yok

        $this->assertSame('paid', $p->fresh()->status);
    }

    public function test_empty_amount_rejected_when_strict(): void
    {
        config(['garanti.strict_amount' => true]);
        $p = $this->makePayment(200000);
        $this->mockBankApproved($p->order_id);

        $this->post('/pay/callback', [])->assertOk();

        $this->assertSame('failed', $p->fresh()->status);
    }
}
