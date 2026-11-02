<?php

namespace Tests\Unit;

use App\Support\PrizeDistribution;
use PHPUnit\Framework\TestCase;

class PrizeDistributionTest extends TestCase
{
    public function test_distinct_ranks_get_their_own_slot(): void
    {
        // Hiç tie yok: her grup tek kişi -> prizes[i] birebir.
        $out = PrizeDistribution::payouts(
            [[10], [20], [30]],
            [['coins' => 100], ['coins' => 50], ['coins' => 25]],
        );
        $this->assertSame([10 => 100, 20 => 50, 30 => 25], $out);
    }

    public function test_tied_group_splits_spanned_slots_evenly(): void
    {
        // 1. tek, sonra 2 kişi 2.-3. dereceyi PAYLAŞIR: (50+25)/2 = 37 + 38 (kalan ilk üyeye).
        $out = PrizeDistribution::payouts(
            [[10], [20, 21]],
            [['coins' => 100], ['coins' => 50], ['coins' => 25]],
        );
        $this->assertSame(100, $out[10]);
        // Korunum: ikisi toplam 75 alir (50+25); eşit-ish 38+37.
        $this->assertSame(75, $out[20] + $out[21]);
        $this->assertSame(38, $out[20]); // kalan ilk üyeye
        $this->assertSame(37, $out[21]);
    }

    public function test_total_payout_is_conserved(): void
    {
        // Toplam ödenen == kapsanan dilimlerin toplamı (4 kişilik tie, 4 dilim).
        $prizes = [['coins' => 100], ['coins' => 40], ['coins' => 30], ['coins' => 20], ['coins' => 10]];
        $out = PrizeDistribution::payouts([[1], [2, 3, 4, 5]], $prizes);
        // grup2 dilimleri index 1..4 = 40+30+20+10 = 100, 4 kişiye 25'er.
        $this->assertSame(100, $out[1]);
        $this->assertSame(25, $out[2]);
        $this->assertSame(25, $out[5]);
        $this->assertSame(100 + 100, array_sum($out)); // toplam korunur
    }

    public function test_group_beyond_prize_table_gets_nothing(): void
    {
        // Ödül yalnız ilk 2 sıraya; sonraki grup dilim kapsamaz -> 0 (out'ta yok).
        $out = PrizeDistribution::payouts(
            [[1], [2], [3, 4]],
            [['coins' => 100], ['coins' => 50]],
        );
        $this->assertSame([1 => 100, 2 => 50], $out);
        $this->assertArrayNotHasKey(3, $out);
        $this->assertArrayNotHasKey(4, $out);
    }

    public function test_partial_slot_coverage_splits_available(): void
    {
        // 2 kişilik tie 2.-3. sırayı kaplar ama ödül tablosu yalnız 2. sıraya (50) var.
        // Eski davranis: 2. kisi 50, 3. kisi 0. Yeni (fair): ikisi 50'yi paylasir (25+25).
        $out = PrizeDistribution::payouts(
            [[1], [2, 3]],
            [['coins' => 100], ['coins' => 50]],
        );
        $this->assertSame(100, $out[1]);
        $this->assertSame(25, $out[2]);
        $this->assertSame(25, $out[3]);
    }
}
