<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WalletIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_same_idempotency_key_applies_wallet_move_once(): void
    {
        if (! Schema::hasColumn('wallet_transactions', 'idempotency_key')) {
            $this->markTestSkipped('Wallet idempotency migration is unavailable.');
        }

        $user = User::factory()->create(['coins' => 100]);
        $wallet = app(WalletService::class);

        $wallet->debit($user, 25, 'test_debit', null, null, 'test-command-1');
        $wallet->debit($user->fresh(), 25, 'test_debit', null, null, 'test-command-1');

        $this->assertSame(75, (int) $user->fresh()->coins);
        $this->assertSame(1, WalletTransaction::where('idempotency_key', 'test-command-1')->count());
    }
}
