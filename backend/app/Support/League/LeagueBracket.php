<?php

namespace App\Support\League;

/**
 * Türkiye Online Tavla Ligi — ELEME AĞACI (§7). SAF/stateless; nihai (dondurulmuş) lig sıralamasından
 * ön eleme + son 16 + sabit ağaç üretir. LeagueRuntime bu yapıyı league_matches satırlarına yazar.
 *
 * YERLEŞİM (§7, standart seri başı): ilk 8 doğrudan son 16'ya; 9-24 ön eleme oynar; 25+ elenir. Ön
 * eleme: 9-24, 10-23, ..., 16-17. Son 16: lig 1.'si ön elemeden gelenler arasında lig sırası EN DÜŞÜK
 * (en kötü) olanla, lig 2.'si bir sonraki en düşükle ... lig 8.'si en iyi ön eleme galibiyle. 8 yuva
 * SEED_ORDER_8 ile ağaca dizilir -> üst sıralar mümkün olduğunca GEÇ karşılaşır (1 ve 2 yalnız finalde).
 * Çeyrek/yarı finalde yeniden sıralama YOK (ağaç sabit).
 *
 * §10 (kullanıcı kararı 2026-11-04): eksik taraf (çekilen/çift-gelmeme ile boşalan yuva) -> dolu taraf
 * maç yapmadan tur atlar (bay gibi); 25. ÇAĞRILMAZ, elenmiş geri gelmez.
 */
class LeagueBracket
{
    /** 8-yuvalı tek-eleme seri başı sırası (seed no, 1-indexli): 1 ve 2 yalnız finalde karşılaşır. */
    public const SEED_ORDER_8 = [1, 8, 5, 4, 3, 6, 7, 2];

    public const DIRECT_SLOTS = 8;   // doğrudan son 16'ya geçen (lig 1-8)

    public const PRELIM_MATCHES = 8; // ön eleme maç sayısı (9-24)

    /**
     * Ön eleme eşleşmeleri: nihai sırada 9-24, 10-23, ..., 16-17.
     *
     * @param  array<int,int>  $rankedActiveIds  AKTİF oyuncular nihai sırayla (index 0 = lig 1.)
     * @return array<int,array{pos:int,hi_rank:int,lo_rank:int,p1:?int,p2:?int}>
     *                                                                           p1/p2 null = o rütbede aktif oyuncu yok (§10 -> dolu taraf tur atlar)
     */
    public static function prelimMatches(array $rankedActiveIds): array
    {
        $out = [];
        for ($i = 0; $i < self::PRELIM_MATCHES; $i++) {
            $hiRank = 9 + $i;   // 9..16
            $loRank = 24 - $i;  // 24..17
            $out[] = [
                'pos' => $i,
                'hi_rank' => $hiRank,
                'lo_rank' => $loRank,
                'p1' => $rankedActiveIds[$hiRank - 1] ?? null, // rank 1-indexli -> dizi 0-indexli
                'p2' => $rankedActiveIds[$loRank - 1] ?? null,
            ];
        }

        return $out;
    }

    /** Doğrudan son 16'ya geçen lig 1-8 (nihai sıradan). */
    public static function directSeeds(array $rankedActiveIds): array
    {
        return array_slice($rankedActiveIds, 0, self::DIRECT_SLOTS);
    }

    /**
     * Ön eleme bitince SON 16 + sabit ağaç. §7: lig 1. en KÖTÜ sıralı ön eleme galibiyle eşleşir, ...,
     * lig 8. en İYİ sıralı galiple. Ağaç SEED_ORDER_8 ile dizilir (yeniden sıralama yok).
     *
     * @param  array<int,int>  $directSeedIds  lig 1..8 (index 0 = lig 1.)
     * @param  array<int,array{id:int,rank:int}>  $prelimWinners  her ön eleme galibi (id + nihai lig sırası);
     *                                                            ön eleme maçında galip yoksa (iki taraf da elendi) listeye KOYMA -> ilgili lig seed'i tur atlar
     * @return array{r16:array,qf:array,sf:array,final:array}
     */
    public static function knockout(array $directSeedIds, array $prelimWinners): array
    {
        // Galipleri lig sırasına göre KÖTÜDEN iyiye (rank DESC) sırala.
        $winners = array_values($prelimWinners);
        usort($winners, fn ($a, $b) => (int) $b['rank'] <=> (int) $a['rank']);

        // Son 16: slot i (0=lig1 ... 7=lig8) = directSeed[i] vs winnersWorstFirst[i] (yoksa null -> tur atlar).
        $r16 = [];
        for ($i = 0; $i < self::DIRECT_SLOTS; $i++) {
            $r16[] = [
                'phase' => 'r16',
                'pos' => $i,
                'p1' => $directSeedIds[$i] ?? null,
                'p2' => isset($winners[$i]) ? (int) $winners[$i]['id'] : null,
            ];
        }

        // Ağaç: SEED_ORDER_8 seed no'larını slot index'e (seed-1) çevir -> yaprak sırası.
        $leaf = array_map(fn ($s) => $s - 1, self::SEED_ORDER_8); // [0,7,4,3,2,5,6,1]

        $qf = [];
        for ($i = 0; $i < 4; $i++) {
            $qf[] = [
                'phase' => 'qf', 'pos' => $i,
                'p1_from' => ['r16', $leaf[$i * 2]],
                'p2_from' => ['r16', $leaf[$i * 2 + 1]],
            ];
        }
        $sf = [
            ['phase' => 'sf', 'pos' => 0, 'p1_from' => ['qf', 0], 'p2_from' => ['qf', 1]],
            ['phase' => 'sf', 'pos' => 1, 'p1_from' => ['qf', 2], 'p2_from' => ['qf', 3]],
        ];
        $final = [
            ['phase' => 'final', 'pos' => 0, 'p1_from' => ['sf', 0], 'p2_from' => ['sf', 1]],
        ];

        return ['r16' => $r16, 'qf' => $qf, 'sf' => $sf, 'final' => $final];
    }
}
