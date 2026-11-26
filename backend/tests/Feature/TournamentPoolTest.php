<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Support\TournamentPool;
use Tests\TestCase;

// Otomatik Ödül Havuzu: giriş ücretleri −%10 komisyon, kalan (net) sıra paylarına ORANLA.
// Tür modeli: Bracket 40/20/15/15 · Swiss 30/18/11/8/8/5/5/5.
class TournamentPoolTest extends TestCase
{
    private function make(array $attrs): Tournament
    {
        $t = new Tournament;
        $t->forceFill($attrs + ['players' => [], 'prizes' => []]);

        return $t;
    }

    private function players(int $n, int $fee): array
    {
        $out = [];
        for ($i = 1; $i <= $n; $i++) {
            $out[] = ['id' => $i, 'name' => 'p'.$i, 'fee_paid' => $fee];
        }

        return $out;
    }

    public function test_disabled_by_default_leaves_prizes_untouched(): void
    {
        $t = $this->make(['players' => $this->players(8, 100), 'prizes' => [['coins' => 50]]]);
        $this->assertFalse(TournamentPool::enabled($t));
        $this->assertSame([['coins' => 50]], TournamentPool::effectivePrizes($t));
    }

    public function test_bracket_model_matches_mockup(): void
    {
        // 8 × 1250 = 10000 gross -> 1000 komisyon -> 9000 net: 40/20/15/15 = 4000/2000/1500/1500
        $t = $this->make(['type' => 'bracket', 'pool_enabled' => true, 'players' => $this->players(8, 1250)]);
        $this->assertSame(10000, TournamentPool::collected($t));
        $this->assertSame(1000, TournamentPool::commission(10000));
        $this->assertSame([4000, 2000, 1500, 1500], TournamentPool::shares($t));
        $this->assertSame([4000, 2000, 1500, 1500], array_column(TournamentPool::effectivePrizes($t), 'coins'));
    }

    public function test_swiss_model_matches_mockup(): void
    {
        // 8 × 1250 = 10000 gross -> 1000 komisyon -> 9000 net: 30/18/11/8/8/5/5/5
        $t = $this->make(['type' => 'swiss_triple', 'pool_enabled' => true, 'players' => $this->players(8, 1250)]);
        $this->assertSame(
            [3000, 1800, 1100, 800, 800, 500, 500, 500],
            TournamentPool::shares($t)
        );
    }

    public function test_admin_override_pcts_repeater_shape(): void
    {
        // pool_pcts (Repeater {pct:..}) override: 1000 -> 900 net, 50/30/20 oranı = 450/270/180
        $t = $this->make(['type' => 'bracket', 'pool_enabled' => true,
            'pool_pcts' => [['pct' => 50], ['pct' => 30], ['pct' => 20]],
            'players' => $this->players(4, 250)]);
        $this->assertSame([450, 270, 180], TournamentPool::shares($t));
    }

    public function test_legacy_p1p2p3_shape_still_reads(): void
    {
        $t = $this->make(['pool_enabled' => true, 'pool_pcts' => ['p1' => 50, 'p2' => 30, 'p3' => 20],
            'players' => $this->players(4, 250)]);
        $this->assertSame([450, 270, 180], TournamentPool::shares($t));
    }

    public function test_rounding_remainder_goes_to_champion_and_conserves(): void
    {
        $t = $this->make(['type' => 'bracket', 'pool_enabled' => true, 'players' => $this->players(3, 37)]);
        // 111 -> komisyon 11 -> 100 net; artık şampiyona, Σpay == net
        $shares = TournamentPool::shares($t);
        $this->assertSame(100, array_sum($shares));
        $this->assertSame([46, 22, 16, 16], $shares);
    }

    public function test_pool_adds_onto_existing_prize_table(): void
    {
        $t = $this->make(['type' => 'bracket', 'pool_enabled' => true, 'players' => $this->players(8, 1250),
            'prizes' => [['coins' => 1000, 'desc' => 'Kupa'], ['coins' => 500]]]);
        $eff = TournamentPool::effectivePrizes($t);
        $this->assertSame([5000, 2500, 1500, 1500], array_column($eff, 'coins'));
        $this->assertSame('Kupa', $eff[0]['desc']);
    }
}
