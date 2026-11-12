<?php

namespace Tests\Feature;

use App\Filament\Pages\CoinGift;
use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Coin Hediye Et — kitle filtreleri doğru kullanıcıları hedefler + WalletService ledger'ına yazar.
 */
class CoinGiftTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::factory()->create();
        $u->forceFill(['is_admin' => true])->save();

        return $u->fresh();
    }

    private function gift(User $admin, array $data): void
    {
        Livewire::actingAs($admin)
            ->test(CoinGift::class)
            ->fillForm($data)
            ->call('gift');
    }

    public function test_non_admin_cannot_open_page(): void
    {
        $this->actingAs(User::factory()->create())->get('/admin/coin-gift')->assertForbidden();
    }

    public function test_gift_to_low_balance_only(): void
    {
        $poor = User::factory()->create(['coins' => 50]);
        $rich = User::factory()->create(['coins' => 5000]);

        $this->gift($this->admin(), ['amount' => 100, 'target' => 'balance', 'max_balance' => 100]);

        $this->assertSame(150, $poor->fresh()->coins);   // altında -> aldı
        $this->assertSame(5000, $rich->fresh()->coins);  // üstünde -> almadı
    }

    public function test_gift_to_match_count_threshold(): void
    {
        $veteran = User::factory()->create(['coins' => 0]);
        $rookie = User::factory()->create(['coins' => 0]);
        for ($i = 0; $i < 12; $i++) {
            MatchResult::create(['user_id' => $veteran->id, 'won' => true,
                'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0]);
        }

        $this->gift($this->admin(), ['amount' => 200, 'target' => 'matches', 'min_matches' => 10]);

        $this->assertSame(200, $veteran->fresh()->coins);
        $this->assertSame(0, $rookie->fresh()->coins);
    }

    public function test_gift_writes_ledger_with_admin_actor(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create(['coins' => 0]);

        $this->gift($admin, ['amount' => 300, 'target' => 'all']);

        $this->assertDatabaseHas('wallet_transactions', [
            'user_id' => $user->id,
            'amount' => 300,
            'type' => 'admin_gift',
            'actor_user_id' => $admin->id,
        ]);
    }
}
