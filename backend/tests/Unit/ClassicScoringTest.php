<?php

namespace Tests\Unit;

use App\Support\Backgammon;
use PHPUnit\Framework\TestCase;

/**
 * KLASIK TAVLA puanlama çekirdeği (sunucu otoritesi). Fark: mars sabit 2, backgammon-3 YOK.
 * src/engine/classic.test.ts ile BİREBİR aynı senaryolar (frontend<->backend kural tutarlılığı).
 */
class ClassicScoringTest extends TestCase
{
    /** points[0..5] = beyazın evi. Kazanan beyaz, kaybeden siyah. */
    private function state(array $over = []): array
    {
        return array_merge([
            'points' => array_fill(0, 24, 0),
            'bar' => ['white' => 0, 'black' => 0],
            'off' => ['white' => 15, 'black' => 0],
        ], $over);
    }

    public function test_normal_win_is_1_in_both_modes(): void
    {
        $s = $this->state(['off' => ['white' => 15, 'black' => 5]]);
        $this->assertSame(1, Backgammon::gamePoints($s, 'white', true));
        $this->assertSame(1, Backgammon::gamePoints($s, 'white', false));
    }

    public function test_mars_is_2_in_both_modes(): void
    {
        $s = $this->state(['off' => ['white' => 15, 'black' => 0]]);
        $this->assertSame(2, Backgammon::gamePoints($s, 'white', true));
        $this->assertSame(2, Backgammon::gamePoints($s, 'white', false));
    }

    public function test_classic_caps_bar_backgammon_at_2(): void
    {
        $s = $this->state(['bar' => ['white' => 0, 'black' => 1]]);
        $this->assertSame(2, Backgammon::gamePoints($s, 'white', true));  // klasik: backgammon-3 YOK
        $this->assertSame(3, Backgammon::gamePoints($s, 'white', false)); // normal: backgammon 3
    }

    public function test_classic_caps_in_winner_home_backgammon_at_2(): void
    {
        $p = array_fill(0, 24, 0);
        $p[2] = -1; // siyah taş, beyazın evinde (0..5)
        $s = $this->state(['points' => $p]);
        $this->assertSame(2, Backgammon::gamePoints($s, 'white', true));
        $this->assertSame(3, Backgammon::gamePoints($s, 'white', false));
    }

    public function test_resignation_value_capped_at_2_in_classic(): void
    {
        $s = $this->state(['off' => ['white' => 0, 'black' => 0], 'bar' => ['white' => 0, 'black' => 1]]);
        $this->assertSame(2, Backgammon::resignationValue($s, 'white', true));
        $this->assertSame(3, Backgammon::resignationValue($s, 'white', false));
    }
}
