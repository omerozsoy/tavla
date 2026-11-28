<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrunePendingPaymentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_stale_pending_is_deleted(): void
    {
        $u = User::factory()->create();

        $stalePending = Payment::create(['user_id' => $u->id, 'kind' => 'cart', 'status' => 'pending', 'amount' => 100, 'order_id' => 'T1']);
        $stalePending->forceFill(['created_at' => now()->subDays(4)])->save();

        $freshPending = Payment::create(['user_id' => $u->id, 'kind' => 'cart', 'status' => 'pending', 'amount' => 100, 'order_id' => 'T2']);
        $freshPending->forceFill(['created_at' => now()->subDays(1)])->save();

        $oldPaid = Payment::create(['user_id' => $u->id, 'kind' => 'cart', 'status' => 'paid', 'amount' => 100, 'order_id' => 'T3']);
        $oldPaid->forceFill(['created_at' => now()->subDays(30)])->save();

        $this->artisan('payments:prune-pending --days=3')->assertSuccessful();

        $this->assertDatabaseMissing('payments', ['id' => $stalePending->id]); // 3 günden eski bekleyen -> silindi
        $this->assertDatabaseHas('payments', ['id' => $freshPending->id]);     // yeni bekleyen -> korundu
        $this->assertDatabaseHas('payments', ['id' => $oldPaid->id]);          // paid ASLA silinmez
    }
}
