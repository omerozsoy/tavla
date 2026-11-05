<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// PayTR bildirim (callback) TUTAR + fulfillment dogrulamasi. PayTR total_amount (KURUS) kayitli
// tutardan AZ olamaz (taksit komisyonu EKLEYEBILIR -> >= kabul). Imza GERCEK HMAC ile uretilir.
class PaymentCallbackTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'test-merchant-key';

    private const SALT = 'test-merchant-salt';

    protected function setUp(): void
    {
        parent::setUp();
        config(['paytr.merchant_id' => 'MID', 'paytr.merchant_key' => self::KEY, 'paytr.merchant_salt' => self::SALT]);
    }

    private function makePayment(int $amount = 200000, string $order = 'ORD1'): Payment
    {
        $u = User::factory()->create(['plan' => 'free']);

        return Payment::create([
            'user_id' => $u->id, 'order_id' => $order, 'plan' => 'premium', 'period' => 'yearly',
            'amount' => $amount, 'currency' => '949', 'status' => 'pending',
        ]);
    }

    /** PayTR bildirimini GERCEK gibi imzala + /pay/paytr-callback'e POST et. */
    private function paytrNotify(string $oid, string $status, string $totalAmount)
    {
        $hash = base64_encode(hash_hmac('sha256', $oid.self::SALT.$status.$totalAmount, self::KEY, true));

        return $this->post('/pay/paytr-callback', [
            'merchant_oid' => $oid, 'status' => $status, 'total_amount' => $totalAmount, 'hash' => $hash,
        ]);
    }

    // Coin (jeton) odemesi plan/period OLMADAN olusabilmeli (1364 hatasi regresyonu).
    public function test_coins_payment_can_be_created_without_plan(): void
    {
        $u = User::factory()->create(['plan' => 'free']);
        $p = Payment::create([
            'user_id' => $u->id, 'kind' => 'coins', 'order_id' => 'TC1', 'amount' => 20000,
            'coins' => 200, 'package_id' => 'baslangicx2', 'currency' => '949', 'status' => 'pending',
        ]);

        $this->assertNull($p->fresh()->plan);
        $this->assertNull($p->fresh()->period);
        $this->assertSame(200, (int) $p->fresh()->coins);
    }

    public function test_matching_amount_activates_plan(): void
    {
        $p = $this->makePayment(200000, 'ORDA');
        $this->paytrNotify('ORDA', 'success', '200000')->assertOk()->assertSee('OK');

        $this->assertSame('paid', $p->fresh()->status);
        $this->assertSame('premium', User::find($p->user_id)->plan);
    }

    public function test_lower_amount_is_rejected(): void
    {
        $p = $this->makePayment(200000, 'ORDB');
        $this->paytrNotify('ORDB', 'success', '100000')->assertOk(); // kayitlidan AZ -> reddet

        $this->assertSame('failed', $p->fresh()->status);
        $this->assertSame('free', User::find($p->user_id)->plan);
    }

    // Taksit komisyonu toplam tutari BUYUTEBILIR (>= kayit) -> yine onaylanir.
    public function test_higher_amount_installment_commission_accepted(): void
    {
        $p = $this->makePayment(200000, 'ORDC');
        $this->paytrNotify('ORDC', 'success', '213000')->assertOk();

        $this->assertSame('paid', $p->fresh()->status);
    }

    public function test_failed_status_marks_failed(): void
    {
        $p = $this->makePayment(200000, 'ORDD');
        $this->paytrNotify('ORDD', 'failed', '200000')->assertOk();

        $this->assertSame('failed', $p->fresh()->status);
        $this->assertSame('free', User::find($p->user_id)->plan);
    }

    // "Üyeliğini Uzat" (kind=renew): mevcut GELECEK bitis tarihine +1 yil EKLENIR (sifirlanmaz).
    public function test_renew_extends_existing_future_expiry(): void
    {
        $until = now()->addDays(30);
        $u = User::factory()->create(['plan' => 'premium', 'plan_until' => $until]);
        $p = Payment::create([
            'user_id' => $u->id, 'kind' => 'renew', 'order_id' => 'TMA', 'plan' => 'premium',
            'period' => 'yearly', 'amount' => 49900, 'currency' => '949', 'status' => 'pending',
        ]);

        $this->paytrNotify('TMA', 'success', '49900')->assertOk();

        $this->assertSame('paid', $p->fresh()->status);
        $expected = $until->copy()->addYear();
        $this->assertEqualsWithDelta($expected->timestamp, User::find($u->id)->plan_until->timestamp, 60);
    }

    // Suresi DOLMUS uyelikte uzatma bugunden baslar (gecmis tarihe eklenmez).
    public function test_renew_starts_from_now_when_expired(): void
    {
        $u = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->subDays(10)]);
        $p = Payment::create([
            'user_id' => $u->id, 'kind' => 'renew', 'order_id' => 'TMB', 'plan' => 'premium',
            'period' => 'yearly', 'amount' => 49900, 'currency' => '949', 'status' => 'pending',
        ]);

        $this->paytrNotify('TMB', 'success', '49900')->assertOk();

        $this->assertEqualsWithDelta(now()->addYear()->timestamp, User::find($u->id)->plan_until->timestamp, 60);
    }
}
