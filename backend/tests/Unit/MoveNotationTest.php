<?php

namespace Tests\Unit;

use App\Support\MoveNotation;
use Tests\TestCase;

/**
 * Adım -> notasyon çevirisi (sunucu-otoriter .mat kaynağı). Perspektif MatReplayLegalityTest ile
 * birebir: beyaz nokta = iç+1, siyah nokta = 24-iç. bar/off korunur, ardışık tekrar "(n)".
 */
class MoveNotationTest extends TestCase
{
    public function test_white_points_are_internal_plus_one(): void
    {
        $steps = [['from' => 23, 'to' => 17, 'die' => 6], ['from' => 12, 'to' => 10, 'die' => 2]];
        $this->assertSame('24/18 13/11', MoveNotation::render($steps, 'white'));
    }

    public function test_black_points_are_24_minus_internal_with_bar(): void
    {
        // Gerçek kayıt (VFE5U seq5): bar->23, 3->9 (die 6) = 21/15 (siyah perspektifi).
        $steps = [['from' => 'bar', 'to' => 1, 'die' => 2], ['from' => 3, 'to' => 9, 'die' => 6]];
        $this->assertSame('bar/23 21/15', MoveNotation::render($steps, 'black'));
    }

    public function test_off_bearoff_notation(): void
    {
        $this->assertSame('6/off', MoveNotation::render([['from' => 5, 'to' => 'off', 'die' => 6]], 'white'));
        $this->assertSame('6/off', MoveNotation::render([['from' => 18, 'to' => 'off', 'die' => 6]], 'black'));
    }

    public function test_consecutive_repeats_compress(): void
    {
        $steps = [['from' => 7, 'to' => 2], ['from' => 7, 'to' => 2]];
        $this->assertSame('8/3(2)', MoveNotation::render($steps, 'white'));
    }

    public function test_empty_steps_is_empty_string(): void
    {
        $this->assertSame('', MoveNotation::render([], 'white'));
    }
}
