<?php

namespace Tests\Unit;

use App\Support\RatingPolicy;
use PHPUnit\Framework\TestCase;

/**
 * YÜKSEK PUANDA AZALAN KAZANÇ (gainMultiplier) — GM/SGM için "kazanmak zor", KAYIP tam.
 * 2000 eşik üstü galibiyet kazancı lineer azalır; 2000 altı klasik Elo (çarpan=1).
 */
class RatingGainTaperTest extends TestCase
{
    public function test_gain_multiplier_curve(): void
    {
        $this->assertSame(1.0, RatingPolicy::gainMultiplier(1500), 'eşik altı tam');
        $this->assertSame(1.0, RatingPolicy::gainMultiplier(2000), 'eşikte tam');
        $this->assertEqualsWithDelta(0.85, RatingPolicy::gainMultiplier(2150), 1e-9); // GM
        $this->assertEqualsWithDelta(0.65, RatingPolicy::gainMultiplier(2350), 1e-9); // SGM
        $this->assertEqualsWithDelta(0.50, RatingPolicy::gainMultiplier(2500), 1e-9);
        $this->assertSame(0.2, RatingPolicy::gainMultiplier(3000), 'taban 0.2');
    }

    /** Eşik altı davranış DEĞİŞMEZ (regresyon yok): 1500 denk galibiyet hâlâ tam simetrik. */
    public function test_below_threshold_unchanged(): void
    {
        $this->assertSame(16, RatingPolicy::eloNewRating(1500, 1500, true, 3) - 1500);
        $this->assertSame(-16, RatingPolicy::eloNewRating(1500, 1500, false, 3) - 1500);
    }

    /** Yüksek puanda Elo galibiyeti AZALIR ama KAYIP tam kalır (asimetri). */
    public function test_elo_high_rating_win_tapers_loss_full(): void
    {
        // 2400 denk eşleşme, L=3: tam transfer 16. Kazanç round(16×0.6)=10, kayıp tam −16.
        $win = RatingPolicy::eloNewRating(2400, 2400, true, 3) - 2400;
        $loss = 2400 - RatingPolicy::eloNewRating(2400, 2400, false, 3);
        $this->assertSame(10, $win, 'kazanç azaldı (16×0.6)');
        $this->assertSame(16, $loss, 'kayıp tam (taper yok)');
        $this->assertLessThan($loss, $win, '2000 üstü: kazanç < kayıp');
    }

    /** Sabit ±delta (düello/turnuva/lig) de yüksek puanda azalır; kayıp tam. */
    public function test_flat_high_rating_win_tapers_loss_full(): void
    {
        // 2400, ±10: galibiyet round(10×0.6)=6, kayıp −10 tam.
        $this->assertSame(2406, RatingPolicy::flatNewRating(2400, true, 10), 'sabit kazanç 10→6');
        $this->assertSame(2390, RatingPolicy::flatNewRating(2400, false, 10), 'sabit kayıp tam −10');
        // Eşik altı sabit tam.
        $this->assertSame(1510, RatingPolicy::flatNewRating(1500, true, 10));
    }

    /** Upset: düşük rating'li kazanan TAM alır (çarpan kendi rating'ine bağlı). */
    public function test_upset_low_rated_winner_full_gain(): void
    {
        // 1500 oyuncu 2400'ü yener: kazanç çarpanı gainMultiplier(1500)=1 → tam Elo kazancı.
        $win = RatingPolicy::eloNewRating(1500, 2400, true, 3) - 1500;
        $this->assertGreaterThan(25, $win, 'güçlüyü yenmek tam ödül');
    }
}
