<?php

namespace Tests\Feature;

use App\Support\MatFromLog;
use Tests\TestCase;

/**
 * MatFromLog OYUN SEGMENTASYONU regresyonu (2026-09-11 kök neden).
 *
 * Bug: online'da bir oyun DROP (küp pas) ile bitince KAZANANIN istemcisinde yerel gameEnd
 * TETİKLENMEZ (sunucu yalnız MAÇ bitişini gameEnd yapar) -> kazananın `g` sayacı ARTMAZ ->
 * sonraki oyunun hamleleri hâlâ g=1 etiketiyle yazılır. `g`'ye güvenen eski segmentasyon
 * oyunları İÇ İÇE geçiriyordu (DROP'tan sonra hamle / tek-sütun oyun / parçalanma / sonuçsuz oyun).
 *
 * Düzeltme: `g` YOK SAYILIR; oyun sınırları her istemcinin HAM append-sıralı dizisinden
 * `s`-reset + terminal (end/drop) ile YENİDEN türetilir. Bu testler o davranışı kilitler.
 */
class MatFromLogSegmentationTest extends TestCase
{
    /**
     * ÖmerDOĞAN_CanerÇELİK dosyasının minimal yeniden üretimi: kazananın (p2/Caner) `g`'si DROP'tan
     * sonra 1'de KALIR ve 2. oyunun hamleleri g=1 ile yazılır. Doğru segmentasyon: DROP oyun 1'i
     * kapatır, g=1 etiketli 2. oyun hamleleri oyun 2'ye gider (iki-sütun), oyun 1'e SIZMAZ.
     */
    public function test_two_client_g_drift_on_drop_is_resegmented(): void
    {
        // p1 = Ömer (beyaz) istemcisi: TÜM oyun-sonlarını gördü -> g DOĞRU. Kendi hamle+küpü +
        // rakibin (recon) hamleleri + end. (Caner'in küpü p1'de YOK — rakip küpü recon edilmez.)
        $p1 = [
            ['g' => 1, 's' => 0, 'p' => 'B', 'd' => '6-2', 'm' => '24/18 13/11'],           // recon: Caner açılış
            ['g' => 1, 's' => 1, 'o' => -3, 'k' => 'cube', 'p' => 'W', 'm' => 'Katla → 2'], // Ömer katla
            ['g' => 1, 's' => 2, 'p' => 'W', 'd' => '2-1', 'm' => '13/11 8/7'],             // Ömer hamle
            ['g' => 1, 's' => 3, 'p' => 'B', 'd' => '4-4', 'm' => '13/9 13/9 9/5 9/5'],     // recon: Caner
            ['g' => 1, 's' => 4, 'o' => -2, 'k' => 'cube', 'p' => 'W', 'm' => 'Pas (çekildi)'], // Ömer PAS (drop)
            ['g' => 1, 's' => 4, 'o' => 9, 'k' => 'end', 'p' => 'B', 'm' => 'Siyah · Kup pas · 2p'], // Ömer: end yazar
            // Oyun 2 (g DOĞRU artmış):
            ['g' => 2, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],
            ['g' => 2, 's' => 1, 'p' => 'B', 'd' => '4-2', 'm' => '8/4 6/4'],               // recon: Caner
            ['g' => 2, 's' => 2, 'o' => 9, 'k' => 'end', 'p' => 'W', 'm' => 'Beyaz · Normal · 1p'],
        ];
        // p2 = Caner (siyah) istemcisi: DROP'u RAKİPTEN aldığı için oyun-1 gameEnd'i TETİKLENMEDİ ->
        // end YAZMADI ve `g` 1'de KALDI -> oyun-2 hamleleri g=1. (Kendi küpü: take + redouble.)
        $p2 = [
            ['g' => 1, 's' => 0, 'p' => 'B', 'd' => '6-2', 'm' => '24/18 13/11'],           // Caner açılış (own)
            ['g' => 1, 's' => 1, 'o' => -2, 'k' => 'cube', 'p' => 'B', 'm' => 'Kabul (2)'], // Caner kabul
            ['g' => 1, 's' => 2, 'p' => 'W', 'd' => '2-1', 'm' => '13/11 8/7'],             // recon: Ömer
            ['g' => 1, 's' => 3, 'p' => 'B', 'd' => '4-4', 'm' => '13/9 13/9 9/5 9/5'],     // Caner (own)
            ['g' => 1, 's' => 4, 'o' => -3, 'k' => 'cube', 'p' => 'B', 'm' => 'Katla → 4'], // Caner redouble
            // Oyun 2 hamleleri — HATALI g=1, ama s=0'a RESET olur:
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],               // recon: Ömer (oyun2)
            ['g' => 1, 's' => 1, 'p' => 'B', 'd' => '4-2', 'm' => '8/4 6/4'],               // Caner (own, oyun2)
        ];

        $mat = MatFromLog::buildFromEvents($p1, $p2, [
            'whiteName' => 'Ömer', 'blackName' => 'Caner', 'matchLength' => 3, 'matchId' => 'RM',
        ]);

        // TAM OLARAK 2 oyun (parçalanma YOK): Game 1, Game 2 var; Game 3 YOK.
        $this->assertStringContainsString(' Game 1', $mat);
        $this->assertStringContainsString(' Game 2', $mat);
        $this->assertStringNotContainsString(' Game 3', $mat);

        [$g1, $g2] = self::splitByGame($mat);

        // Oyun 1: DROP oyunu kapatır; sonuç Caner 2 puan. 2. oyunun hamlesi (8/5 6/5) SIZMAMALI.
        $this->assertStringContainsString('Drops', $g1);
        $this->assertStringContainsString('Doubles => 2', $g1);
        $this->assertStringContainsString('Doubles => 4', $g1);
        $this->assertStringContainsString('Wins 2 point', $g1);
        $this->assertStringContainsString('Losses 2 point', $g1);
        $this->assertStringNotContainsString('8/5 6/5', $g1);   // 2. oyun hamlesi oyun 1'e sızmadı
        $this->assertStringNotContainsString('8/4 6/4', $g1);

        // Oyun 2: İKİ oyuncunun da hamlesi (iki sütun) + sonuç. Skor satırı oyun 1'i yansıtır (Caner 2).
        $this->assertStringContainsString('8/5 6/5', $g2);      // Ömer
        $this->assertStringContainsString('8/4 6/4', $g2);      // Caner
        $this->assertMatchesRegularExpression('/Caner : 2/', $g2);
        $this->assertStringContainsString('Wins 1 point', $g2);
    }

    /** TEST 1 — DOUBLE + REDOUBLE + DROP: drop oyunu DERHAL bitirir; sonraki hamle YENİ oyundadır. */
    public function test_drop_ends_game_next_move_is_new_game(): void
    {
        // Tek istemci akışı (build): A katla->2, B kabul, B redouble->4, A drop, SONRA bir hamle.
        $turns = [
            ['g' => 1, 's' => 0, 'o' => -3, 'k' => 'cube', 'p' => 'W', 'm' => 'Katla → 2'],
            ['g' => 1, 's' => 0, 'o' => -2, 'k' => 'cube', 'p' => 'B', 'm' => 'Kabul (2)'],
            ['g' => 1, 's' => 1, 'o' => -3, 'k' => 'cube', 'p' => 'B', 'm' => 'Katla → 4'],
            ['g' => 1, 's' => 1, 'o' => -2, 'k' => 'cube', 'p' => 'W', 'm' => 'Pas (çekildi)'], // A drop
            // DROP sonrası hamle -> YENİ oyun (aynı g etiketli olsa bile):
            ['g' => 1, 's' => 0, 'p' => 'B', 'd' => '5-3', 'm' => '24/21 13/8'],
        ];
        $mat = MatFromLog::build($turns, ['matchLength' => 3]);

        [$g1, $g2] = self::splitByGame($mat);
        $this->assertStringContainsString('Drops', $g1);
        $this->assertStringContainsString('Wins 2 point', $g1);       // B, drop'ta 2 kazanır
        $this->assertStringNotContainsString('24/21 13/8', $g1);       // drop sonrası hamle oyun 1'de DEĞİL
        $this->assertNotEmpty($g2);
        $this->assertStringContainsString('24/21 13/8', $g2);          // yeni oyunda
    }

    /** TEST 2 — NO MOVE: oynanamayan tur (dance) zarı MAT'ta korunur ("63:" hamlesiz). */
    public function test_no_move_roll_preserves_dice(): void
    {
        $turns = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '6-3', 'm' => ''],  // legal hamle yok
            ['g' => 1, 's' => 1, 'p' => 'B', 'd' => '2-1', 'm' => '24/23 13/11'],
            ['g' => 1, 's' => 9, 'o' => 9, 'k' => 'end', 'p' => 'B', 'm' => 'Siyah · Normal · 1p'],
        ];
        $mat = MatFromLog::build($turns, ['matchLength' => 1]);

        $this->assertStringContainsString('63:', $mat);                // zar korundu
        $this->assertDoesNotMatchRegularExpression('/63:\s*\S/', substr($mat, strpos($mat, '63:'), 6)); // hamle token yok
    }

    /**
     * REGRESYON (ÖmerDOĞAN_NeuralAI dosyası): AYNI ZARLI iki FARKLI no-move (dance) turu
     * KAYBOLMAMALI. Eski dedup içerik-tabanlıydı (dice+notation); dance'te notation boş olduğundan
     * aynı zarlı iki dance çakışıp siliniyordu -> tur kaybı + rakip art arda zar atmış görünümü.
     * Kimlik-tabanlı dedup (rg,player,seq,o) her iki dance'i de korur.
     */
    public function test_duplicate_dice_dances_not_deduped(): void
    {
        // pvb (tek istemci): W iki kez '52' ile dans eder (s0 ve s4). Aralarda gerçek turlar.
        $p1 = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '5-2', 'm' => ''],                 // W dance #1 (52)
            ['g' => 1, 's' => 1, 'p' => 'B', 'd' => '3-1', 'm' => '24/21 13/12'],      // B hamle
            ['g' => 1, 's' => 2, 'p' => 'W', 'd' => '6-4', 'm' => '13/7 13/9'],        // W hamle
            ['g' => 1, 's' => 3, 'p' => 'B', 'd' => '2-2', 'm' => '24/22 24/22 6/4 6/4'], // B hamle
            ['g' => 1, 's' => 4, 'p' => 'W', 'd' => '5-2', 'm' => ''],                 // W dance #2 (52) — AYNI ZAR
            ['g' => 1, 's' => 5, 'p' => 'B', 'd' => '6-5', 'm' => '13/7 13/8'],        // B hamle
            ['g' => 1, 's' => 9, 'o' => 9, 'k' => 'end', 'p' => 'B', 'm' => 'Siyah · Normal · 1p'],
        ];
        $mat = MatFromLog::buildFromEvents($p1, [], ['whiteName' => 'W', 'blackName' => 'B', 'matchLength' => 1]);

        // İki '52:' dance de görünmeli (biri silinmemeli).
        $this->assertSame(2, substr_count($mat, '52:'), 'aynı zarlı iki dance de korunmalı');
        // Rakip (B) art arda görünmemeli: her B hamlesinin solunda bir W girdisi olmalı ->
        // sağ-sütun-yalnız satır (numara + boşluk + sağ) OLUŞMAMALI.
        $this->assertDoesNotMatchRegularExpression('/^\s*\d+\)\s{20,}\S/m', $mat, 'sol sütun boş (rakip art arda) satır olmamalı');
    }

    /**
     * REGRESYON (OmerOzsoy_NeuralAI 1-point dosyası): 1-point match'te oyun puanı maç hedefini
     * AŞAMAZ. Gammon (end event 2p) bile "Wins 1 point and the match" olmalı; ASLA "Wins 2 point".
     * (Otoriter gammon sonucu korunur; yalnız MAÇA yazılan puan hedefe kırpılır — gnubg gibi.)
     */
    public function test_one_point_match_caps_gammon_to_single(): void
    {
        $turns = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '6-5', 'm' => '24/18 13/8'],
            ['g' => 1, 's' => 1, 'p' => 'B', 'd' => '4-2', 'm' => '24/20 13/11'],
            ['g' => 1, 's' => 9, 'o' => 9, 'k' => 'end', 'p' => 'W', 'm' => 'Beyaz · Mars · 2p'], // gammon=2
        ];
        $mat = MatFromLog::build($turns, ['matchLength' => 1, 'matchId' => 'ONE']);

        $this->assertStringContainsString('Wins 1 point and the match', $mat);
        $this->assertStringNotContainsString('Wins 2 point', $mat); // 1-point match'te 2 puan YAZILMAZ
    }

    /** TEST 3 — MULTI GAME: 3 oyunlu maçta hiçbir hamle yanlış oyuna kaymaz. */
    public function test_multi_game_no_cross_contamination(): void
    {
        // Her oyunu ayrı bir bear-off hamlesiyle işaretle; end olayları oyunları böler.
        $mk = fn (int $g, string $wMove, string $bMove) => [
            ['g' => $g, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => $wMove],
            ['g' => $g, 's' => 1, 'p' => 'B', 'd' => '4-2', 'm' => $bMove],
            ['g' => $g, 's' => 9, 'o' => 9, 'k' => 'end', 'p' => 'W', 'm' => 'Beyaz · Normal · 1p'],
        ];
        $turns = array_merge($mk(1, '8/5 6/5', '24/20 13/11'), $mk(2, '13/10 6/5', '13/9 24/22'), $mk(3, '8/7 6/4', '13/8 6/4'));
        $mat = MatFromLog::build($turns, ['matchLength' => 5]);

        [$g1, $g2, $g3] = self::splitByGame($mat);
        // Her oyunun kendi hamleleri KENDİ bloğunda, diğerlerinde DEĞİL.
        $this->assertStringContainsString('8/5 6/5', $g1);
        $this->assertStringNotContainsString('8/5 6/5', $g2.$g3);
        $this->assertStringContainsString('13/10 6/5', $g2);
        $this->assertStringNotContainsString('13/10 6/5', $g1.$g3);
        $this->assertStringContainsString('8/7 6/4', $g3);
        $this->assertStringNotContainsString('8/7 6/4', $g1.$g2);
    }

    /** TEST 4 — DETERMINISM: aynı girdi için 10 çalıştırma BYTE-LEVEL aynı .mat üretir. */
    public function test_determinism_10x(): void
    {
        $p1 = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],
            ['g' => 1, 's' => 1, 'p' => 'B', 'd' => '4-2', 'm' => '24/20 13/11'],
            ['g' => 1, 's' => 9, 'o' => 9, 'k' => 'end', 'p' => 'W', 'm' => 'Beyaz · Normal · 1p'],
        ];
        $p2 = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],
            ['g' => 1, 's' => 1, 'p' => 'B', 'd' => '4-2', 'm' => '24/20 13/11'],
        ];
        $opts = ['whiteName' => 'A', 'blackName' => 'B', 'matchLength' => 1, 'matchId' => 'DET', 'eventDate' => '2026.09.11'];
        $hashes = [];
        for ($i = 0; $i < 10; $i++) {
            $hashes[] = md5(MatFromLog::buildFromEvents($p1, $p2, $opts));
        }
        $this->assertCount(1, array_unique($hashes), '10 export BYTE-LEVEL aynı olmalı');
    }

    /** ` Game N` başlıklarına göre .mat gövdesini oyun bloklarına ayır (başlık bloğu hariç). */
    private static function splitByGame(string $mat): array
    {
        $parts = preg_split('/^ Game \d+.*$/m', $mat);
        array_shift($parts); // başlık + "N point match" öncesi

        return array_values($parts);
    }
}
