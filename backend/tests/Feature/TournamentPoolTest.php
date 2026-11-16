<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Support\TournamentPool;
use Tests\TestCase;

// Yüzdeli ödül havuzu: giriş ücretleri −%10 komisyon, kalan 1./2./3.'ye yüzdeyle.
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

    public function test_default_split_after_ten_percent_commission(): void
    {
        // 8 × 125 = 1000 toplandı -> 100 komisyon -> 900 net: 540 / 225 / 135
        $t = $this->make(['pool_enabled' => true, 'players' => $this->players(8, 125)]);
        $this->assertSame(1000, TournamentPool::collected($t));
        $this->assertSame(100, TournamentPool::commission(1000));
        $this->assertSame([540, 225, 135], TournamentPool::shares($t));
        $this->assertSame([540, 225, 135], array_column(TournamentPool::effectivePrizes($t), 'coins'));
    }

    public function test_custom_percentages_from_form_shape(): void
    {
        $t = $this->make(['pool_enabled' => true, 'pool_pcts' => ['p1' => 50, 'p2' => 30, 'p3' => 20],
            'players' => $this->players(4, 250)]);
        // 1000 -> 900 net: 450 / 270 / 180
        $this->assertSame([450, 270, 180], TournamentPool::shares($t));
    }

    public function test_rounding_remainder_goes_to_champion_and_conserves(): void
    {
        $t = $this->make(['pool_enabled' => true, 'players' => $this->players(3, 37)]);
        // 111 -> komisyon 11 -> 100 net
        $shares = TournamentPool::shares($t);
        $this->assertSame(100, array_sum($shares));
        $this->assertSame([60, 25, 15], $shares);

        $t2 = $this->make(['pool_enabled' => true, 'players' => $this->players(7, 13)]);
        // 91 -> komisyon 9 -> 82 net
        $this->assertSame(82, array_sum(TournamentPool::shares($t2)));
    }

    public function test_pool_adds_onto_existing_prize_table(): void
    {
        $t = $this->make(['pool_enabled' => true, 'players' => $this->players(8, 125),
            'prizes' => [['coins' => 1000, 'desc' => 'Kupa'], ['coins' => 500]]]);
        $eff = TournamentPool::effectivePrizes($t);
        $this->assertSame([1540, 725, 135], array_column($eff, 'coins'));
        $this->assertSame('Kupa', $eff[0]['desc']);
    }
}
