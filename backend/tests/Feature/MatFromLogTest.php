<?php

namespace Tests\Feature;

use App\Support\MatFromLog;
use Tests\TestCase;

/**
 * MatFromLog: game_logs KOMPAKT tur kaydından ({g,s,p,d,m,o,k}) XG-uyumlu .mat üretimi.
 * Kompakt log HER modda vardır ve tamdır (online: birleştirilmiş iki slot; pvb/local: tek istemci
 * ikisini de yazar), bu yüzden yönetim panelinde her maç için .mat üretilebilir.
 */
class MatFromLogTest extends TestCase
{
    public function test_builds_valid_xg_header_and_single_game(): void
    {
        $turns = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],
            ['g' => 1, 's' => 0, 'p' => 'B', 'd' => '4-2', 'm' => '24/20 13/11'],
            ['g' => 1, 's' => 2, 'p' => 'W', 'd' => '6-6', 'm' => '24/18(2) 13/7(2)'],
            ['g' => 1, 's' => 9, 'p' => 'W', 'o' => 9, 'k' => 'end', 'm' => 'Beyaz · Normal · 1p'],
        ];

        $mat = MatFromLog::build($turns, [
            'whiteName' => 'Omer',
            'blackName' => 'Rakip',
            'matchLength' => 1,
            'matchId' => 'ABC123',
        ]);

        // XG başlık bloğu + maç uzunluğu satırı.
        $this->assertStringContainsString('; [Site "TavlaTV"]', $mat);
        $this->assertStringContainsString('; [Player 1 "Omer"]', $mat);
        $this->assertStringContainsString('; [Player 2 "Rakip"]', $mat);
        $this->assertStringContainsString('1 point match', $mat);
        $this->assertStringContainsString(' Game 1', $mat);
        // Hamleler doğru sütunda.
        $this->assertStringContainsString('8/5 6/5', $mat);
        $this->assertStringContainsString('24/20 13/11', $mat);
        // Tekrar parantezi AÇILMALI (XG lehçesi: 24/18(2) -> "24/18 24/18").
        $this->assertStringContainsString('24/18 24/18', $mat);
        $this->assertStringNotContainsString('24/18(2)', $mat);
        // Tek oyun maçı bittiğinde "and the match".
        $this->assertStringContainsString('Wins 1 point and the match', $mat);
    }

    public function test_bar_and_off_are_translated_to_xg_dialect(): void
    {
        $turns = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '5-3', 'm' => 'bar/20 6/3'],
            ['g' => 1, 's' => 2, 'p' => 'W', 'd' => '2-1', 'm' => '2/off 1/off'],
            ['g' => 1, 's' => 9, 'p' => 'W', 'k' => 'end', 'm' => 'Beyaz · Mars · 2p'],
        ];
        $mat = MatFromLog::build($turns, ['matchLength' => 3]);

        $this->assertStringContainsString('25/20', $mat);   // bar -> 25
        $this->assertStringContainsString('6/3', $mat);
        $this->assertStringContainsString('2/0', $mat);     // off -> 0
        $this->assertStringContainsString('1/0', $mat);
        $this->assertStringNotContainsString('bar/', $mat);
        $this->assertStringNotContainsString('/off', $mat);
        // Mars = 2 puan, maç 3 puanlık -> henüz bitmedi -> "and the match" YOK.
        $this->assertStringContainsString('Wins 2 point', $mat);
        $this->assertStringNotContainsString('and the match', $mat);
    }

    public function test_cube_double_take_produces_paired_rows(): void
    {
        $turns = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],
            ['g' => 1, 's' => 1, 'o' => -3, 'k' => 'cube', 'p' => 'B', 'm' => 'Katla → 2'],
            ['g' => 1, 's' => 1, 'o' => -2, 'k' => 'cube', 'p' => 'W', 'm' => 'Kabul (2)'],
            ['g' => 1, 's' => 2, 'p' => 'B', 'd' => '6-4', 'm' => '24/18 13/9'],
            ['g' => 1, 's' => 9, 'p' => 'B', 'k' => 'end', 'm' => 'Siyah · Normal · 2p'],
        ];
        $mat = MatFromLog::build($turns, ['matchLength' => 5]);

        $this->assertStringContainsString('Doubles => 2', $mat);
        $this->assertStringContainsString('Takes', $mat);
        // Siyah kazandı -> numaralı iki-sütun "Losses/Wins" satırı.
        $this->assertStringContainsString('Losses 2 point', $mat);
        $this->assertStringContainsString('Wins 2 point', $mat);
    }

    public function test_multiple_games_split_by_game_number(): void
    {
        $turns = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],
            ['g' => 1, 's' => 9, 'p' => 'W', 'k' => 'end', 'm' => 'Beyaz · Normal · 1p'],
            ['g' => 2, 's' => 0, 'p' => 'B', 'd' => '5-2', 'm' => '13/8 24/22'],
            ['g' => 2, 's' => 9, 'p' => 'B', 'k' => 'end', 'm' => 'Siyah · Normal · 1p'],
        ];
        $mat = MatFromLog::build($turns, ['matchLength' => 3]);

        $this->assertStringContainsString(' Game 1', $mat);
        $this->assertStringContainsString(' Game 2', $mat);
        // İkinci oyunun skor satırı ilk oyunun kazananını (beyaz 1) yansıtmalı.
        $this->assertMatchesRegularExpression('/Game 2\n .*: 1/', $mat);
    }

    public function test_empty_log_returns_header_only(): void
    {
        $mat = MatFromLog::build([], ['matchLength' => 1]);
        $this->assertStringContainsString('1 point match', $mat);
        $this->assertStringNotContainsString(' Game 1', $mat);
    }

    // --- Determinizm / kanonik zar / küp regresyonu (tavlatv-mac (5) vs (21) kök nedeni) ---

    public function test_dice_are_canonically_normalized_high_first(): void
    {
        // Kaynak sırası ne olursa olsun (2-3 veya 3-2) DAİMA yüksek zar önce yazılır -> "32".
        $this->assertSame('32', MatFromLog::xgDice('2-3'));
        $this->assertSame('32', MatFromLog::xgDice('3-2'));
        $this->assertSame('21', MatFromLog::xgDice('1-2'));
        $this->assertSame('53', MatFromLog::xgDice('3-5'));
        $this->assertSame('64', MatFromLog::xgDice('6-4')); // zaten yüksek önce
        $this->assertSame('55', MatFromLog::xgDice('5-5')); // çift değişmez
    }

    public function test_dice_order_in_log_does_not_change_output(): void
    {
        $mk = fn (string $d) => [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => $d, 'm' => '13/11 24/21'],
            ['g' => 1, 's' => 9, 'p' => 'W', 'k' => 'end', 'm' => 'Beyaz · Normal · 1p'],
        ];
        $opts = ['matchLength' => 1, 'matchId' => 'X'];
        // Aynı hamle, zar "2-3" vs "3-2" -> BYTE-LEVEL aynı .mat (kanonik "32").
        $this->assertSame(MatFromLog::build($mk('2-3'), $opts), MatFromLog::build($mk('3-2'), $opts));
        $this->assertStringContainsString('32:', MatFromLog::build($mk('2-3'), $opts));
    }

    public function test_export_is_deterministic_10x(): void
    {
        $turns = [
            ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],
            ['g' => 1, 's' => 1, 'o' => -3, 'k' => 'cube', 'p' => 'B', 'm' => 'Katla → 2'],
            ['g' => 1, 's' => 1, 'o' => -2, 'k' => 'cube', 'p' => 'W', 'm' => 'Kabul (2)'],
            ['g' => 1, 's' => 2, 'p' => 'B', 'd' => '6-4', 'm' => '24/18 13/9'],
            ['g' => 1, 's' => 9, 'p' => 'B', 'k' => 'end', 'm' => 'Siyah · Normal · 2p'],
        ];
        $opts = ['matchLength' => 5, 'matchId' => 'DET', 'eventDate' => '2026.09.09', 'eventTime' => '03.32'];
        $hashes = [];
        for ($i = 0; $i < 10; $i++) {
            $hashes[] = md5(MatFromLog::build($turns, $opts));
        }
        $this->assertCount(1, array_unique($hashes), '10 export byte-level aynı olmalı');
    }

    public function test_cube_regression_double_redouble_not_lost_and_points_correct(): void
    {
        // A double->2, B take, B double->4, A take, A backgammon (end event 12p).
        // Küp eventleri KAYBOLMAMALI ve sonuç kayıtlı otoriter puanı (12) yazmalı (3 DEĞİL).
        // NOT: matchLength 12'den KÜÇÜK olsaydı puan maç hedefine KIRPILIRDI (match play) -> küp
        // korumasını ölçemezdik; bu yüzden hedef 15 (12'yi kapsar, kırpma no-op).
        $turns = [
            ['g' => 1, 's' => 0, 'o' => -3, 'k' => 'cube', 'p' => 'W', 'm' => 'Katla → 2'],
            ['g' => 1, 's' => 0, 'o' => -2, 'k' => 'cube', 'p' => 'B', 'm' => 'Kabul (2)'],
            ['g' => 1, 's' => 1, 'o' => -3, 'k' => 'cube', 'p' => 'B', 'm' => 'Katla → 4'],
            ['g' => 1, 's' => 1, 'o' => -2, 'k' => 'cube', 'p' => 'W', 'm' => 'Kabul (4)'],
            ['g' => 1, 's' => 2, 'p' => 'W', 'd' => '2-1', 'm' => '2/off 1/off'],
            ['g' => 1, 's' => 9, 'p' => 'W', 'k' => 'end', 'm' => 'Beyaz · Çifte mars · 12p'],
        ];
        $mat = MatFromLog::build($turns, ['matchLength' => 15, 'matchId' => 'CUBE']);

        $this->assertStringContainsString('Doubles => 2', $mat);
        $this->assertStringContainsString('Doubles => 4', $mat);
        $this->assertSame(2, substr_count($mat, 'Takes'));
        $this->assertStringContainsString('Wins 12 point', $mat);
        $this->assertStringNotContainsString('Wins 3 point', $mat); // küp kaybolsaydı 3 çıkardı
    }
}
