<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletAtomicityTest extends TestCase
{
    use RefreshDatabase;

    public function test_debit_uses_current_locked_balance_and_writes_ledger_atomically(): void
    {
        $user = User::factory()->create(['coins' => 100, 'coins_reserved' => 0]);
        $stale = User::findOrFail($user->id);
        $wallet = app(WalletService::class);

        $wallet->debit($user, 80, 'test_debit', 'test', 1);

        try {
            $wallet->debit($stale, 30, 'stale_debit', 'test', 2);
            $this->fail('A stale debit must be rejected against the current locked balance.');
        } catch (\RuntimeException $e) {
            $this->assertSame('Wallet balance cannot be negative.', $e->getMessage());
        }

        $this->assertSame(20, (int) $user->fresh()->coins);
        $this->assertDatabaseCount('wallet_transactions', 1);
        $this->assertDatabaseHas('wallet_transactions', [
            'amount' => -80,
            'balance_before' => 100,
            'balance_after' => 20,
        ]);
    }
}
