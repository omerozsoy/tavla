<?php

namespace Tests\Unit;

use App\Services\MedianPerformanceService;
use App\Support\StatsConfig;
use PHPUnit\Framework\TestCase;

// Saf domain matematigi (DB'siz): median hesabi + WXP/kategori kurallari.
class MedianWxpUnitTest extends TestCase
{
    // ---- MEDIAN ----
    public function test_median_empty_is_null(): void
    {
        $this->assertNull(MedianPerformanceService::median([]));
    }

    public function test_median_single_value(): void
    {
        $this->assertSame(4.20, MedianPerformanceService::median([4.20]));
    }

    public function test_median_odd_count_middle(): void
    {
        // [4.20,5.10,7.30,8.40,15.90] -> 7.30
        $this->assertSame(7.30, MedianPerformanceService::median([15.90, 4.20, 8.40, 5.10, 7.30]));
    }

    public function test_median_three_values(): void
    {
        $this->assertSame(5.10, MedianPerformanceService::median([7.30, 4.20, 5.10]));
    }

    public function test_median_two_values_is_average(): void
    {
        // (5.10 + 7.30) / 2 = 6.20
        $this->assertSame(6.20, MedianPerformanceService::median([7.30, 5.10]));
    }

    public function test_median_even_count_average_of_middle_two(): void
    {
        // [4.20,5.10,7.30,8.40] -> (5.10+7.30)/2 = 6.20
        $this->assertSame(6.20, MedianPerformanceService::median([8.40, 4.20, 7.30, 5.10]));
    }

    public function test_median_two_decimal_precision(): void
    {
        // 6.3789 -> 6.38
        $this->assertSame(6.38, MedianPerformanceService::median([6.3789]));
        $this->assertSame(6.38, MedianPerformanceService::median([6.3789, 6.3789]));
    }

    // ---- WXP KURALLARI ----
    public function test_wxp_amounts(): void
    {
        $this->assertSame(1, StatsConfig::wxpForWin('coin', 1));
        $this->assertSame(1, StatsConfig::wxpForWin('coin', null));
        $this->assertSame(1, StatsConfig::wxpForWin('match', 1));
        $this->assertSame(3, StatsConfig::wxpForWin('match', 3));
        $this->assertSame(5, StatsConfig::wxpForWin('match', 5));
        $this->assertSame(7, StatsConfig::wxpForWin('match', 7));
    }

    public function test_wxp_unsupported_length_is_zero(): void
    {
        $this->assertSame(0, StatsConfig::wxpForWin('match', 9));
        $this->assertSame(0, StatsConfig::wxpForWin('match', null));
    }

    // ---- KATEGORI ESLEME ----
    public function test_category_key_mapping(): void
    {
        $this->assertSame('coin', StatsConfig::categoryKey('coin', 1));
        $this->assertSame('coin', StatsConfig::categoryKey('coin', null));
        $this->assertSame('1', StatsConfig::categoryKey('match', 1));
        $this->assertSame('5', StatsConfig::categoryKey('match', 5));
        $this->assertSame('7', StatsConfig::categoryKey('match', 7));
        $this->assertNull(StatsConfig::categoryKey('match', 9)); // tanimsiz kategori
        $this->assertNull(StatsConfig::categoryKey('match', null));
    }
}
