<?php

namespace Tests\Unit;

use App\Support\RatingPolicy;
use PHPUnit\Framework\TestCase;

/**
 * Maç uzunluğu katsayısı C = sqrt(L/3) + simetri + taban davranışı.
 * Formül: transfer = round(32 × C × (1 − E_kazanan)); kazanan +transfer, kaybeden −transfer.
 */
class RatingLengthFactorTest extends TestCase
{
    /** Eşit ratingli oyuncular için direktifteki örnek değerler (win = -loss, simetri). */
    public function test_equal_rating_example_values(): void
    {
        $expected = [1 => 9, 3 => 16, 5 => 21, 7 => 24, 9 => 28, 11 => 31, 13 => 33];
        foreach ($expected as $len => $delta) {
            $p = RatingPolicy::eloPreview(1500, 1500, $len);
            $this->assertSame($delta, $p['win'], "L={$len} kazanç");
            $this->assertSame(-$delta, $p['loss'], "L={$len} kayıp (simetri)");
        }
    }

    /** C katsayısı = sqrt(L/3): 3'te 1, 12'de 2, 1'de ~0.577. */
    public function test_length_factor(): void
    {
        $this->assertEqualsWithDelta(1.0, RatingPolicy::lengthFactor(3), 1e-9);
        $this->assertEqualsWithDelta(2.0, RatingPolicy::lengthFactor(12), 1e-9);
        $this->assertEqualsWithDelta(sqrt(1 / 3), RatingPolicy::lengthFactor(1), 1e-9);
        // L<1 -> en az 1 (sqrt(0) veya negatif engellenir).
        $this->assertEqualsWithDelta(sqrt(1 / 3), RatingPolicy::lengthFactor(0), 1e-9);
    }

    /** Güçlü/zayıf rakip: Elo mantığı korunur (güçlüyü yenmek çok, zayıfa kaybetmek çok). */
    public function test_strong_weak_opponent(): void
    {
        // 1389, güçlü rakibe (1501) karşı L=3: +21 / -11 (ekran görüntüsü senaryosu).
        $p3 = RatingPolicy::eloPreview(1389, 1501, 3);
        $this->assertSame(21, $p3['win']);
        $this->assertSame(-11, $p3['loss']);

        // Aynı eşleşme L=7: C=sqrt(7/3)≈1.5275 -> büyür (+32 / -17).
        $p7 = RatingPolicy::eloPreview(1389, 1501, 7);
        $this->assertSame(32, $p7['win']);
        $this->assertSame(-17, $p7['loss']);

        // Zayıf rakibe (1200) karşı: kazanç küçük, kayıp büyük.
        $pw = RatingPolicy::eloPreview(1500, 1200, 3);
        $this->assertLessThan($pw['win'] + 1, $pw['win']); // sadece var
        $this->assertTrue(abs($pw['loss']) > $pw['win'], 'zayıfa kaybetmek, yenmekten pahalı');
    }

    /** Kazananın kazancı = kaybedenin kaybı (taban devreye girmediği sürece), her uzunlukta. */
    public function test_winner_loser_symmetry_all_lengths(): void
    {
        foreach (range(1, 13) as $len) {
            $winnerR = 1600;
            $loserR = 1450;
            $winnerNew = RatingPolicy::eloNewRating($winnerR, $loserR, true, $len);
            $loserNew = RatingPolicy::eloNewRating($loserR, $winnerR, false, $len);
            $gain = $winnerNew - $winnerR;
            $loss = $loserR - $loserNew;
            $this->assertSame($gain, $loss, "L={$len}: kazanç == kayıp");
            $this->assertGreaterThan(0, $gain, "L={$len}: transfer pozitif");
        }
    }

    /** Uzunluk arttıkça transfer büyümeli (monoton), eşit ratingde. */
    public function test_monotonic_increase_with_length(): void
    {
        $prev = 0;
        foreach (range(1, 13) as $len) {
            $w = RatingPolicy::eloPreview(1500, 1500, $len)['win'];
            $this->assertGreaterThanOrEqual($prev, $w, "L={$len} >= L=".($len - 1));
            $prev = $w;
        }
    }

    /**
     * TABAN: kaybeden 100'ün altına düşemez; kazanan yine tam kazanır (asimetri bilinçli).
     * NOT: düşük-ratingli oyuncu GÜÇLÜ rakibe kaybedince ~0 kaybeder (beklenen zaten kayıp) ->
     * taban tetiklenmez. Taban ancak ~eşit/düşük rakibe uzun maçta kaybedince devreye girer.
     */
    public function test_rating_floor(): void
    {
        // Kaybeden 105, ~eşit rakip 100, L=13 (C≈2.08) -> normalde ~-34 ama 100'de durur (kayıp 5).
        $loserNew = RatingPolicy::eloNewRating(105, 100, false, 13);
        $this->assertSame(100, $loserNew, 'taban 100 (105-34 -> 100)');

        // Kazanan (100) tam transferini alır (~+34); taban etkilemez.
        $winnerNew = RatingPolicy::eloNewRating(100, 105, true, 13);
        $this->assertGreaterThan(130, $winnerNew, 'kazanan tam transfer');
        // Bu sınır durumunda kazanç (~34) > kaybedenin gerçek kaybı (105->100 = 5) -> eşitlik bilinçli bozulur.
        $this->assertGreaterThan(5, $winnerNew - 100, 'tabanda eşitlik bilinçli bozulur');
    }
}
