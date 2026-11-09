<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Odeme kaydi (Payment) olusturma dogrulamasi. (Kart odemesi PayTR'siz: PENDING Payment olusur,
// fulfillment admin onayinda — otomatik callback KALDIRILDI.)
class PaymentCallbackTest extends TestCase
{
    use RefreshDatabase;

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
}
