<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\WalletService;
use App\Support\WalletBreakdown;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletBreakdownTest extends TestCase
{
    use RefreshDatabase;

    public function test_breakdown_categorizes_sources_and_reconciles_clean(): void
    {
        $u = User::factory()->create(['coins' => 0]);
        $wallet = app(WalletService::class);

        $wallet->credit($u, 500, 'daily_reward');
        $wallet->credit($u, 1000, 'match_settlement_credit');
        $wallet->debit($u->fresh(), 200, 'dice_slot_spin');
        $wallet->credit($u->fresh(), 800, 'dice_slot_payout');

        $w = WalletBreakdown::for($u->fresh());

        $this->assertTrue($w['available']);
        $this->assertTrue($w['recon']['clean'], 'Ledger-only balance must reconcile clean');
        $this->assertSame(0, $w['recon']['unexplained']);
        $this->assertSame(2300, $w['total_credited']);
        $this->assertSame(200, $w['total_debited']);
        $this->assertSame(2100, (int) $u->fresh()->coins);

        $cats = collect($w['categories'])->keyBy('key');
        $this->assertSame(1000, $cats['match']['net']);
        $this->assertSame(600, $cats['slot']['net']); // 800 payout - 200 spin
        $this->assertSame(500, $cats['daily']['net']);
    }

    public function test_admin_adjustment_records_acting_admin(): void
    {
        $target = User::factory()->create(['coins' => 100]);
        $admin = User::factory()->create(['is_admin' => true]);

        app(WalletService::class)->setBalance($target, 5000, 'admin_adjustment', $admin->id);

        $w = WalletBreakdown::for($target->fresh());

        $this->assertNotEmpty($w['admin_events']);
        $this->assertSame($admin->nickname, $w['admin_events'][0]['actor']);
        $this->assertSame(4900, $w['admin_events'][0]['amount']);
        $this->assertTrue($w['recon']['clean']);
    }

    public function test_out_of_ledger_coins_are_flagged_as_unexplained(): void
    {
        $u = User::factory()->create(['coins' => 0]);
        app(WalletService::class)->credit($u, 1000, 'daily_reward');

        // Defteri atlayarak doğrudan bakiyeyi şişir (kaçak para senaryosu)
        User::whereKey($u->id)->update(['coins' => 999999]);

        $r = WalletBreakdown::quickRecon($u->id, 999999);
        $this->assertFalse($r['clean']);
        $this->assertFalse($r['balance_ok']);
        $this->assertSame(999999 - 1000, $r['unexplained']);
        $this->assertTrue($r['internal_ok']); // defter kendi içinde tutarlı; sadece bakiye şişmiş
    }
}
