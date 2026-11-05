<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// PAYTR BILDIRIM IMZASI (HMAC-SHA256) guvenligi:
//  - sahte/bozuk hash: ASLA fulfill etmez, 'OK' DEMEZ (PayTR gecerli imzayla tekrar dener).
//  - gecerli basarili bildirim: coin yukler + 'OK' doner.
//  - idempotent: ayni bildirim 2x gelse coin TEK kez yuklenir (retry/replay guvenli).
class PayTRCallbackSecurityTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'mk-secret';

    private const SALT = 'ms-salt';

    protected function setUp(): void
    {
        parent::setUp();
        config(['paytr.merchant_id' => 'MID', 'paytr.merchant_key' => self::KEY, 'paytr.merchant_salt' => self::SALT]);
    }

    private function coinPayment(string $oid, int $amount = 90000, int $coins = 1000): Payment
    {
        $u = User::factory()->create(['coins' => 0]);

        return Payment::create([
            'user_id' => $u->id, 'kind' => 'coins', 'order_id' => $oid, 'amount' => $amount,
            'coins' => $coins, 'package_id' => 'sandik', 'currency' => '949', 'status' => 'pending',
        ]);
    }

    private function sign(string $oid, string $status, string $total): string
    {
        return base64_encode(hash_hmac('sha256', $oid.self::SALT.$status.$total, self::KEY, true));
    }

    public function test_forged_hash_is_rejected_and_not_fulfilled(): void
    {
        $p = $this->coinPayment('FORGE1');

        $this->post('/pay/paytr-callback', [
            'merchant_oid' => 'FORGE1', 'status' => 'success', 'total_amount' => '90000',
            'hash' => 'deadbeef-not-a-valid-hash',
        ])->assertStatus(400);

        $this->assertSame('pending', $p->fresh()->status); // degismedi
        $this->assertSame(0, (int) User::find($p->user_id)->coins); // coin YUKLENMEDI
    }

    public function test_valid_success_credits_coins_and_returns_ok(): void
    {
        $p = $this->coinPayment('OK1', 90000, 1000);

        $this->post('/pay/paytr-callback', [
            'merchant_oid' => 'OK1', 'status' => 'success', 'total_amount' => '90000',
            'hash' => $this->sign('OK1', 'success', '90000'),
        ])->assertOk()->assertSee('OK');

        $this->assertSame('paid', $p->fresh()->status);
        $this->assertSame(1000, (int) User::find($p->user_id)->coins);
    }

    public function test_duplicate_callback_credits_once(): void
    {
        $p = $this->coinPayment('DUP1', 90000, 1000);
        $hash = $this->sign('DUP1', 'success', '90000');
        $body = ['merchant_oid' => 'DUP1', 'status' => 'success', 'total_amount' => '90000', 'hash' => $hash];

        $this->post('/pay/paytr-callback', $body)->assertOk();
        $this->post('/pay/paytr-callback', $body)->assertOk(); // retry/replay

        $this->assertSame(1000, (int) User::find($p->user_id)->coins); // TEK kez
    }
}
