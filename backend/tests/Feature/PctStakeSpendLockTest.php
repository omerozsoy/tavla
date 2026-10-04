<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// A-03: %-bahis (bet_pct) maçında emanet yok; kaybeden settle'dan ÖNCE coin'lerini (çark/slot/dükkân/
// ürün/turnuva) harcayıp ödemeyi kalıcı 409'a düşürebiliyordu. Artık sonuçlanmamış %-maçtaki bahis
// tutarı harcanabilir bakiyeden düşülür; maç ödemesi (settlement) bu kısıta tabi değildir.
class PctStakeSpendLockTest extends TestCase
{
    use RefreshDatabase;

    private function pctRoom(User $a, User $b, string $status, ?string $winner, int $snapA, int $snapB, bool $settled = false): Room
    {
        return Room::create([
            'code' => 'PCT'.random_int(100, 999), 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $a->id, 'p2_user_id' => $b->id, 'p1_name' => 'A', 'p2_name' => 'B',
            'status' => $status, 'mode' => 'ranked', 'stake' => 0, 'bet_pct' => 100, 'settled' => $settled,
            'authoritative' => true, 'version' => 0, 'server_version' => 0,
            'server_match' => ['target' => 1, 'done' => $status === 'finished', 'winner' => $winner,
                'score' => ['white' => 0, 'black' => 1],
                'pct_stake_snapshot' => [(string) $a->id => $snapA, (string) $b->id => $snapB]],
        ]);
    }

    public function test_unsettled_decided_pct_match_locks_stake_from_discretionary_spend(): void
    {
        $a = User::factory()->create(['coins' => 1000]);
        $b = User::factory()->create(['coins' => 1000]);
        $this->pctRoom($a, $b, 'finished', 'black', 1000, 1000); // a (beyaz) kaybetti, henüz settle yok
        $w = app(WalletService::class);

        $this->assertSame(0, $w->spendable($a->fresh()));
        foreach (['dice_slot_spin', 'lucky_wheel_spin', 'shop_purchase', 'product_purchase', 'cart_purchase', 'tournament_entry'] as $type) {
            try {
                $w->debit($a->fresh(), 10, $type);
                $this->fail("$type kilitli bahis tutarını harcayabildi");
            } catch (\RuntimeException $e) {
                $this->assertStringContainsString('spendable', $e->getMessage());
            }
        }
        $this->assertSame(1000, (int) $a->fresh()->coins);
        // Maç ödemesi kısıta tabi DEĞİL (kazanana ödeme yapılabilmeli).
        $w->debit($a->fresh(), 1000, 'match_settlement_debit');
        $this->assertSame(0, (int) $a->fresh()->coins);
    }

    public function test_playing_pct_match_locks_only_the_stake_not_the_whole_balance(): void
    {
        $a = User::factory()->create(['coins' => 1000]);
        $b = User::factory()->create(['coins' => 1000]);
        $this->pctRoom($a, $b, 'playing', null, 300, 300);
        $w = app(WalletService::class);
        $this->assertSame(700, $w->spendable($a->fresh()));
        $w->debit($a->fresh(), 700, 'shop_purchase');
        $this->assertSame(300, (int) $a->fresh()->coins);
        $this->expectException(\RuntimeException::class);
        $w->debit($a->fresh(), 1, 'shop_purchase');
    }

    public function test_settled_or_undecided_or_old_pct_rooms_do_not_lock(): void
    {
        $a = User::factory()->create(['coins' => 1000]);
        $b = User::factory()->create(['coins' => 1000]);
        $this->pctRoom($a, $b, 'finished', 'black', 1000, 1000, true);   // settle edilmiş
        $this->pctRoom($a, $b, 'finished', null, 1000, 1000);            // kazanansız (no-contest)
        $old = $this->pctRoom($a, $b, 'finished', 'black', 1000, 1000);  // 30 günden eski
        Room::whereKey($old->id)->update(['updated_at' => now()->subDays(40)]);
        $this->assertSame(1000, app(WalletService::class)->spendable($a->fresh()));
    }
}
