<?php

namespace Tests\Unit;

use App\Analysis\PositionClassifier;
use App\Analysis\PositionFeatureExtractor as FX;
use App\Support\ErrorJournalConfig as Cfg;
use PHPUnit\Framework\TestCase;

/**
 * Saf domain (DB'siz): pozisyon ozellik cikarimi + siniflandirma + severity.
 * Board konvansiyonu engine/types.ts ile ayni (index0=1.ucgen, +beyaz/-siyah).
 */
class ErrorJournalClassifierTest extends TestCase
{
    /** index=>signed count haritasindan GameState kur. */
    private function pos(array $points, array $bar = [], array $off = []): array
    {
        $p = array_fill(0, 24, 0);
        foreach ($points as $i => $c) {
            $p[$i] = $c;
        }

        return [
            'points' => $p,
            'bar' => ['white' => $bar['white'] ?? 0, 'black' => $bar['black'] ?? 0],
            'off' => ['white' => $off['white'] ?? 0, 'black' => $off['black'] ?? 0],
        ];
    }

    private function cat(array $pos, string $player = 'white', int $ply = 12, ?string $prev = null): string
    {
        return PositionClassifier::classify(FX::extract($pos, $player, $ply), $player, $prev)['primaryCategory'];
    }

    // Standart acilis pozisyonu
    private function start(): array
    {
        return $this->pos([0 => -2, 5 => 5, 7 => 3, 11 => -5, 12 => 5, 16 => -3, 18 => -5, 23 => 2]);
    }

    // ---- FEATURE EXTRACTOR ----
    public function test_start_pip_is_167_each(): void
    {
        $f = FX::extract($this->start(), 'white', 0);
        $this->assertSame(167, $f['myPipCount']);
        $this->assertSame(167, $f['opponentPipCount']);
        $this->assertTrue($f['contactExists']);
        $this->assertFalse($f['pureRace']);
    }

    public function test_pure_race_has_no_contact(): void
    {
        $race = $this->pos([
            0 => 2, 1 => 3, 2 => 3, 3 => 3, 4 => 2, 5 => 2,
            18 => -2, 19 => -3, 20 => -3, 21 => -3, 22 => -2, 23 => -2,
        ]);
        $f = FX::extract($race, 'white', 30);
        $this->assertTrue($f['pureRace']);
        $this->assertFalse($f['contactExists']);
    }

    // ---- SEVERITY ----
    public function test_severity_bands(): void
    {
        $this->assertNull(Cfg::severity(0.0));
        $this->assertNull(Cfg::severity(0.019));
        $this->assertSame('inaccuracy', Cfg::severity(0.02));
        $this->assertSame('inaccuracy', Cfg::severity(0.039));
        $this->assertSame('mistake', Cfg::severity(0.04));
        $this->assertSame('mistake', Cfg::severity(0.079));
        $this->assertSame('blunder', Cfg::severity(0.08));
        $this->assertSame('blunder', Cfg::severity(1.0));
    }

    // ---- SINIFLANDIRMA ----
    public function test_opening_dominates_start_anchors(): void
    {
        // Baslangicta iki taraf da 24-point anchor tutar; yine de ACILIS olmali.
        $this->assertSame(Cfg::CAT_OPENING, $this->cat($this->start(), 'white', 1));
    }

    public function test_race(): void
    {
        $race = $this->pos([
            0 => 2, 1 => 3, 2 => 3, 3 => 3, 4 => 2, 5 => 2,
            18 => -2, 19 => -3, 20 => -3, 21 => -3, 22 => -2, 23 => -2,
        ]);
        $this->assertSame(Cfg::CAT_RACE, $this->cat($race, 'white', 30));
    }

    public function test_deep_anchor(): void
    {
        // Beyaz tek derin anchor: rakip 1-point (index 23)
        $p = $this->pos([
            23 => 2, 12 => 3, 7 => 3, 5 => 5, 4 => 2,       // beyaz 15
            8 => -3, 13 => -5, 16 => -4, 18 => -3,           // siyah 15
        ]);
        $this->assertSame(Cfg::CAT_DEEP_ANCHOR, $this->cat($p, 'white', 20));
    }

    public function test_holding_game(): void
    {
        // Beyaz tek ileri anchor: rakip 5-point (index 19)
        $p = $this->pos([
            19 => 2, 12 => 3, 7 => 3, 5 => 5, 4 => 2,
            8 => -3, 13 => -5, 16 => -4, 21 => -3,
        ]);
        $this->assertSame(Cfg::CAT_HOLDING, $this->cat($p, 'white', 20));
    }

    public function test_mutual_holding_beats_holding(): void
    {
        // Beyaz rakip 4-point (index20) anchor + siyah beyaz 4-point (index3) anchor
        $p = $this->pos([
            20 => 2, 12 => 3, 7 => 3, 5 => 5, 4 => 2,
            3 => -2, 8 => -2, 13 => -5, 16 => -4, 21 => -2,
        ]);
        $this->assertSame(Cfg::CAT_MUTUAL_HOLDING, $this->cat($p, 'white', 20));
    }

    public function test_one_checker_back(): void
    {
        // Beyaz geride tek blot (index20), bar yok, baska geri tas yok
        $p = $this->pos([
            20 => 1, 12 => 2, 11 => 3, 7 => 3, 5 => 4, 4 => 2,
            8 => -2, 13 => -5, 16 => -4, 18 => -2, 21 => -2,
        ]);
        $this->assertSame(Cfg::CAT_ONE_CHECKER_BACK, $this->cat($p, 'white', 20));
    }

    public function test_six_prime(): void
    {
        // Beyaz 1..7 ardisik made point; siyah index0'da (prime gerisinde) tuzakli
        $p = $this->pos([
            1 => 2, 2 => 2, 3 => 2, 4 => 2, 5 => 2, 6 => 2, 7 => 1,
            0 => -2, 13 => -2, 16 => -5, 18 => -4, 21 => -2,
        ]);
        $this->assertSame(Cfg::CAT_SIX_PRIME, $this->cat($p, 'white', 15));
    }

    public function test_middle_game_fallback(): void
    {
        $p = $this->pos([
            6 => 2, 7 => 3, 8 => 2, 12 => 3, 13 => 3, 16 => 2,
            10 => -2, 11 => -3, 15 => -3, 17 => -2, 20 => -5,
        ]);
        $this->assertSame(Cfg::CAT_MIDDLE_GAME, $this->cat($p, 'white', 12));
    }

    public function test_blitz_early(): void
    {
        // Rakip bar'da, beyaz 3 home point + dis saha spare; siyahin guvenli anchor'i yok
        $p = $this->pos([
            3 => 2, 4 => 2, 5 => 2, 7 => 2, 8 => 3, 12 => 2, 13 => 2,
            10 => -2, 15 => -3, 16 => -4, 18 => -5,
        ], ['black' => 1]);
        $this->assertSame(Cfg::CAT_BLITZ_EARLY, $this->cat($p, 'white', 8));
    }

    public function test_backgame_early(): void
    {
        // Beyaz 2 anchor (rakip 1 ve 4 point) + timing (dis saha spare) iyi
        $p = $this->pos([
            23 => 2, 20 => 2, 7 => 4, 8 => 2, 12 => 2, 13 => 2, 11 => 1,
            6 => -2, 10 => -3, 15 => -4, 16 => -3, 18 => -3,
        ]);
        $this->assertSame(Cfg::CAT_BACKGAME_EARLY, $this->cat($p, 'white', 15));
    }
}
