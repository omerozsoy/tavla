<?php

namespace Tests\Feature;

use App\Support\MatSerializer;
use RuntimeException;
use Tests\TestCase;

/**
 * MatSerializer DOĞRULAMA/DURDURMA kalkanı (ÖmerDOĞAN_NeuralAI .mat regresyonu 2026-09-13):
 *  - gamePointsWon = cubeValue × winMultiplier; İMKÂNSIZ puan (ör. 7-puanlık maçta küpsüz "8")
 *    ASLA yazılmaz -> [1,3] çarpana kırpılır.
 *  - XG (kullanıcı indirmesi): SON-OLMAYAN bir oyun sonuçsuzsa (previousGame.result=null) export
 *    DURUR (RuntimeException). gnubg (luck) yolu TOLERE eder (byte-identity + tarihsel davranış).
 */
class MatSerializerGuardTest extends TestCase
{
    /** Tek hamlelik basit bir oyun modeli (acts çiftlenmiş). */
    private function game(string $winner, int $points, int $cube = 1): array
    {
        return [
            'acts' => [['kind' => 'move', 'player' => 'white', 'dice' => [3, 1], 'notation' => '8/5 6/5']],
            'outcome' => ['winner' => $winner, 'points' => $points, 'cube' => $cube],
        ];
    }

    public function test_impossible_points_are_clamped_never_written(): void
    {
        // 7-puanlık maç, küp 1, points=8 (İMKÂNSIZ: cube×winType değil). Çarpan 8 -> 3'e kırpılır.
        $mat = MatSerializer::render([$this->game('white', 8, 1)], ['dialect' => 'xg', 'matchLength' => 7]);

        $this->assertStringNotContainsString('Wins 8 point', $mat);
        $this->assertStringContainsString('Wins 3 point', $mat); // max geçerli çarpan (backgammon)
    }

    public function test_valid_points_are_preserved(): void
    {
        // Küp 2 × gammon(2) = 4 -> geçerli, aynen yazılır.
        $mat = MatSerializer::render([$this->game('white', 4, 2)], ['dialect' => 'xg', 'matchLength' => 7]);
        $this->assertStringContainsString('Wins 4 point', $mat);
    }

    public function test_xg_halts_when_non_last_game_has_no_result(): void
    {
        $games = [
            ['acts' => [['kind' => 'move', 'player' => 'white', 'dice' => [3, 1], 'notation' => '8/5 6/5']], 'outcome' => null],
            $this->game('black', 1, 1),
        ];

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/Game 1 sonuçsuz/u');
        MatSerializer::render($games, ['dialect' => 'xg', 'matchLength' => 5]);
    }

    public function test_xg_last_game_null_result_is_tolerated(): void
    {
        // SON oyun sonuçsuz olabilir (maç henüz bitmemiş) -> hata YOK, sonuç satırı yazılmaz.
        $games = [
            $this->game('white', 1, 1),
            ['acts' => [['kind' => 'move', 'player' => 'black', 'dice' => [3, 1], 'notation' => '8/5 6/5']], 'outcome' => null],
        ];
        $mat = MatSerializer::render($games, ['dialect' => 'xg', 'matchLength' => 5]);

        $this->assertStringContainsString(' Game 2', $mat); // ikinci oyun yine yazılır
        $this->assertSame(1, substr_count($mat, 'Wins ')); // yalnız 1. oyunun sonucu
    }

    public function test_gnubg_tolerates_non_last_null_result(): void
    {
        // gnubg (luck) yolu ara oyunda sonuç bulamayabilir (analiz logu zorunlu hamleyi atlar);
        // ATMAZ, sessizce satırı geçer.
        $games = [
            ['acts' => [['kind' => 'move', 'player' => 'white', 'dice' => [3, 1], 'notation' => '8/5 6/5']], 'outcome' => null],
            $this->game('black', 1, 1),
        ];
        $mat = MatSerializer::render($games, ['dialect' => 'gnubg', 'matchLength' => 5]);
        $this->assertStringContainsString('Wins 1 point', $mat); // 2. oyun sonucu yazıldı, hata yok
    }
}
