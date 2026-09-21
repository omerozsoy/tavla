<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class ResetCoinsLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_coins_records_each_balance_change_in_the_ledger(): void
    {
        User::factory()->create(['coins' => 400, 'coins_reserved' => 25]);
        User::factory()->create(['coins' => 75, 'coins_reserved' => 0]);

        Artisan::call('tavla:reset-coins', ['--amount' => 100, '--force' => true]);

        $this->assertSame(2, User::where('coins', 100)->count());
        $this->assertSame(0, User::where('coins_reserved', '>', 0)->count());
        $this->assertDatabaseCount('wallet_transactions', 2);
        $this->assertDatabaseHas('wallet_transactions', ['type' => 'admin_reset_coins', 'balance_after' => 100]);
    }
}
