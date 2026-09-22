<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DailyRewardIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_daily_reward_claim_key_is_stable_for_a_cooldown_window(): void
    {
        if (! Schema::hasColumn('wallet_transactions', 'idempotency_key')) {
            $this->markTestSkipped('Wallet idempotency migration is unavailable.');
        }

        $user = User::factory()->create(['coins' => 100]);
        $wallet = app(WalletService::class);
        $key = 'daily_reward:'.$user->id.':initial';

        $wallet->credit($user, 25, 'daily_reward', null, null, $key);
        $wallet->credit($user->fresh(), 25, 'daily_reward', null, null, $key);

        $this->assertSame(125, (int) $user->fresh()->coins);
        $this->assertSame(1, WalletTransaction::where('type', 'daily_reward')->count());
    }
}
