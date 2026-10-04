<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// GARANTI 3D DÖNÜŞ İMZASI (denetim A-01, A-07) — GERÇEK GarantiService ile (mock YOK).
//  A-01: hashparams istekten gelir; karar alanları imza kapsamında olmak zorunda değildi ->
//        bankanın imzaladığı herhangi bir dizi başka bir alan adına konup (hashparams=x&x=S)
//        imzasız mdstatus/response/procreturncode/orderid ile başka sipariş "onaylanıyordu".
//  A-07: imzasız (sahte) bir callback bekleyen ödemeyi 'failed' yapıyordu -> gerçek onay reddediliyordu.
class GarantiCallbackSecurityTest extends TestCase
{
    use RefreshDatabase;

    private const STORE_KEY = 'test-store-key';

    protected function setUp(): void
    {
        parent::setUp();
        config(['garanti.store_key' => self::STORE_KEY, 'garanti.hash_version' => 'v2', 'garanti.strict_amount' => true]);
    }

    private function payment(int $amount, string $order): Payment
    {
        $u = User::factory()->create(['plan' => 'free', 'coins' => 0]);

        return Payment::create([
            'user_id' => $u->id, 'kind' => 'coins', 'order_id' => $order, 'amount' => $amount,
            'coins' => 1000, 'package_id' => 'sandik', 'currency' => '949', 'status' => 'pending',
        ]);
    }

    /** Bankanın yapacağı gibi imzala: hashparams sırasıyla değerler + store key -> SHA512 (büyük harf). */
    private function signed(array $fields, string $hashparams): array
    {
        $concat = '';
        foreach (explode(':', $hashparams) as $k) {
            if ($k !== '') {
                $concat .= $fields[$k] ?? '';
            }
        }

        return $fields + ['hashparams' => $hashparams, 'hash' => strtoupper(hash('sha512', $concat.self::STORE_KEY))];
    }

    private const HP = 'clientid:oid:orderid:authcode:procreturncode:response:mdstatus:txnamount:';

    public function test_genuine_signed_approval_is_credited(): void
    {
        $p = $this->payment(90000, 'TCORDER1');
        $post = $this->signed(['clientid' => '1', 'oid' => 'TCORDER1', 'orderid' => 'TCORDER1', 'authcode' => 'A1',
            'procreturncode' => '00', 'response' => 'Approved', 'mdstatus' => '1', 'txnamount' => '90000'], self::HP);
        $this->post('/pay/callback', $post)->assertOk();
        $this->assertSame('paid', $p->fresh()->status);
    }

    public function test_reused_signature_with_unsigned_decision_fields_is_rejected(): void
    {
        // Saldırgan kendi ucuz ödemesinin GERÇEK (reddedilmiş) banka dönüşünü elde eder.
        $own = $this->payment(10000, 'TCCHEAP1');
        $declined = $this->signed(['clientid' => '1', 'oid' => 'TCCHEAP1', 'orderid' => 'TCCHEAP1', 'authcode' => '',
            'procreturncode' => '05', 'response' => 'Declined', 'mdstatus' => '1', 'txnamount' => '10000'], self::HP);
        $s = '';
        foreach (explode(':', self::HP) as $k) {
            if ($k !== '') {
                $s .= $declined[$k];
            }
        }
        $victim = $this->payment(400000, 'TCBIG001');
        // Aynı imzayı tek bir "x" alanına taşı; karar alanlarını imzasız olarak "onay" yap.
        $this->post('/pay/callback', [
            'hashparams' => 'x:', 'x' => $s, 'hash' => $declined['hash'],
            'orderid' => 'TCBIG001', 'mdstatus' => '1', 'response' => 'Approved', 'procreturncode' => '00', 'txnamount' => '400000',
        ])->assertOk();
        $this->assertSame('pending', $victim->fresh()->status, 'imzasız karar alanlarıyla ödeme onaylanmamalı');
        $this->assertSame(0, (int) User::find($victim->user_id)->coins);
        $this->assertSame('pending', $own->fresh()->status);
    }

    public function test_unsigned_forged_failure_does_not_kill_pending_payment(): void
    {
        $p = $this->payment(90000, 'TCORDER2');
        $this->post('/pay/callback', ['orderid' => 'TCORDER2', 'mdstatus' => '0', 'response' => 'Declined'])->assertOk();
        $this->assertSame('pending', $p->fresh()->status, 'imzasız red bekleyen ödemeyi düşürmemeli');
        // Sonra gelen gerçek onay hâlâ kredilenir.
        $post = $this->signed(['clientid' => '1', 'oid' => 'TCORDER2', 'orderid' => 'TCORDER2', 'authcode' => 'A2',
            'procreturncode' => '00', 'response' => 'Approved', 'mdstatus' => '1', 'txnamount' => '90000'], self::HP);
        $this->post('/pay/callback', $post)->assertOk();
        $this->assertSame('paid', $p->fresh()->status);
    }

    public function test_signed_decline_marks_failed(): void
    {
        $p = $this->payment(90000, 'TCORDER3');
        $post = $this->signed(['clientid' => '1', 'oid' => 'TCORDER3', 'orderid' => 'TCORDER3', 'authcode' => '',
            'procreturncode' => '05', 'response' => 'Declined', 'mdstatus' => '1', 'txnamount' => '90000'], self::HP);
        $this->post('/pay/callback', $post)->assertOk();
        $this->assertSame('failed', $p->fresh()->status);
    }

    public function test_oid_orderid_mismatch_and_missing_decision_field_are_rejected(): void
    {
        $a = $this->payment(90000, 'TCORDER4');
        $b = $this->payment(90000, 'TCORDER5');
        // oid imzalı (A), orderid imzasız ve farklı (B) -> reddedilmeli.
        $post = $this->signed(['clientid' => '1', 'oid' => 'TCORDER4', 'authcode' => 'A',
            'procreturncode' => '00', 'response' => 'Approved', 'mdstatus' => '1', 'txnamount' => '90000'],
            'clientid:oid:authcode:procreturncode:response:mdstatus:txnamount:');
        $this->post('/pay/callback', $post + ['orderid' => 'TCORDER5'])->assertOk();
        $this->assertSame('pending', $a->fresh()->status);
        $this->assertSame('pending', $b->fresh()->status);
        // mdstatus imza kapsamında değil -> reddedilmeli.
        $post2 = $this->signed(['clientid' => '1', 'oid' => 'TCORDER4', 'orderid' => 'TCORDER4', 'authcode' => 'A',
            'procreturncode' => '00', 'response' => 'Approved', 'txnamount' => '90000'],
            'clientid:oid:orderid:authcode:procreturncode:response:txnamount:');
        $this->post('/pay/callback', $post2 + ['mdstatus' => '1'])->assertOk();
        $this->assertSame('pending', $a->fresh()->status);
    }
}
