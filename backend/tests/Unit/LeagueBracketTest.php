<?php

namespace Tests\Unit;

use App\Support\League\LeagueBracket;
use PHPUnit\Framework\TestCase;

/**
 * Eleme ağacı (§7) + §10 boş-yuva kuralı birim testleri.
 */
class LeagueBracketTest extends TestCase
{
    /** rank R (1-indexli) -> id. id = 100 + rank (rank1=101 ... rank24=124). */
    private function ranked(int $n): array
    {
        $out = [];
        for ($r = 1; $r <= $n; $r++) {
            $out[] = 100 + $r;
        }

        return $out;
    }

    /** Ön eleme eşleşmeleri 9-24, 10-23, ..., 16-17 (§7). */
    public function test_prelim_pairs_9_24_down_to_16_17(): void
    {
        $pre = LeagueBracket::prelimMatches($this->ranked(24));
        $this->assertCount(8, $pre);
        // ilk maç: rank9 (id109) vs rank24 (id124)
        $this->assertSame(109, $pre[0]['p1']);
        $this->assertSame(124, $pre[0]['p2']);
        // son maç: rank16 (id116) vs rank17 (id117)
        $this->assertSame(116, $pre[7]['p1']);
        $this->assertSame(117, $pre[7]['p2']);
    }

    /** 33+ sezon de aynı sınır: yalnız 9-24 ön eleme, 25+ (varsa) ağaca girmez. */
    public function test_prelim_ignores_rank_25_and_beyond(): void
    {
        $pre = LeagueBracket::prelimMatches($this->ranked(33));
        $ids = [];
        foreach ($pre as $m) {
            $ids[] = $m['p1'];
            $ids[] = $m['p2'];
        }
        // Tüm ön eleme oyuncuları 109..124 aralığında (rank 9-24); 125+ yok.
        foreach ($ids as $id) {
            $this->assertGreaterThanOrEqual(109, $id);
            $this->assertLessThanOrEqual(124, $id);
        }
    }

    /** Son 16: lig 1. en KÖTÜ sıralı galiple; lig 8. en İYİ galiple (§7). */
    public function test_r16_pairs_top_seed_with_worst_winner(): void
    {
        $direct = array_slice($this->ranked(24), 0, 8); // lig1..8 = 101..108
        // Her ön elemede "hi" (daha iyi sıralı) kazansın: galipler rank 9..16 = id 109..116
        $winners = [];
        for ($i = 0; $i < 8; $i++) {
            $winners[] = ['id' => 109 + $i, 'rank' => 9 + $i];
        }
        $k = LeagueBracket::knockout($direct, $winners);

        // lig1 (101) en kötü galiple = rank16 (id116)
        $this->assertSame(101, $k['r16'][0]['p1']);
        $this->assertSame(116, $k['r16'][0]['p2']);
        // lig8 (108) en iyi galiple = rank9 (id109)
        $this->assertSame(108, $k['r16'][7]['p1']);
        $this->assertSame(109, $k['r16'][7]['p2']);
    }

    /** Ağaç: lig 1. (slot0) ve lig 2. (slot1) yalnız FİNALDE karşılaşabilir (zıt yarılar). */
    public function test_top_two_seeds_meet_only_in_final(): void
    {
        $direct = array_slice($this->ranked(24), 0, 8);
        $winners = [];
        for ($i = 0; $i < 8; $i++) {
            $winners[] = ['id' => 109 + $i, 'rank' => 9 + $i];
        }
        $k = LeagueBracket::knockout($direct, $winners);

        // slot0 (lig1) hangi QF'de? slot1 (lig2) hangi QF'de? Aynı SF'de OLMAMALI.
        $qfOfSlot = function (int $slot) use ($k): int {
            foreach ($k['qf'] as $q) {
                if ($q['p1_from'][1] === $slot || $q['p2_from'][1] === $slot) {
                    return $q['pos'];
                }
            }

            return -1;
        };
        $sfOfQf = function (int $qf) use ($k): int {
            foreach ($k['sf'] as $s) {
                if ($s['p1_from'][1] === $qf || $s['p2_from'][1] === $qf) {
                    return $s['pos'];
                }
            }

            return -1;
        };
        $sf1 = $sfOfQf($qfOfSlot(0));
        $sf2 = $sfOfQf($qfOfSlot(1));
        $this->assertNotSame($sf1, $sf2, 'lig 1 ve lig 2 aynı yarı finale düşmemeli (finalden önce karşılaşır)');
    }

    /** §10: bir ön elemede galip yoksa (iki taraf elendi) eşleşeceği lig seed'i tur atlar (boş yuva). */
    public function test_missing_prelim_winner_leaves_empty_slot(): void
    {
        $direct = array_slice($this->ranked(24), 0, 8);
        // Yalnız 7 galip (bir ön eleme maçı iki-taraf-elenme ile galipsiz):
        $winners = [];
        for ($i = 0; $i < 7; $i++) {
            $winners[] = ['id' => 109 + $i, 'rank' => 9 + $i];
        }
        $k = LeagueBracket::knockout($direct, $winners);

        // 7 galip -> slot7 (lig8) rakipsiz (null) = maç yapmadan tur atlar.
        $this->assertSame(108, $k['r16'][7]['p1']);
        $this->assertNull($k['r16'][7]['p2']);
    }
}
