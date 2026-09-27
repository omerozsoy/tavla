<?php

namespace Tests\Feature;

use App\Models\MatchMove;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SUNUCU-OTORİTER .mat: match_moves satırlarından (istemci logu YOK) doğru gnubg .mat + analiz logu.
 * Sunucu her doğrulanan hamle/küp/oyun-sonu için satır yazar; buildMat/buildLog bu tek gerçek
 * kaynaktan kurulur -> istemci reload/disconnect'te veri kaybı ("olmayan hamle"/yarım oyun) BİTER.
 */
class MatchMoveMatTest extends TestCase
{
    use RefreshDatabase;

    private function seedGame(string $code): void
    {
        $rows = [
            ['seq' => 0, 'ord' => 0, 'player' => 'white', 'kind' => 'move', 'dice' => [3, 1], 'notation' => '8/5 6/5', 'pos' => ['points' => []]],
            ['seq' => 1, 'ord' => 0, 'player' => 'black', 'kind' => 'move', 'dice' => [3, 2], 'notation' => '24/23 13/11', 'pos' => ['points' => []]],
            ['seq' => 2, 'ord' => -3, 'player' => 'white', 'kind' => 'double', 'cube_value' => 1, 'pos' => ['points' => []]],
            ['seq' => 2, 'ord' => -2, 'player' => 'black', 'kind' => 'take', 'cube_value' => 1, 'pos' => ['points' => []]],
            ['seq' => 2, 'ord' => 0, 'player' => 'white', 'kind' => 'move', 'dice' => [6, 1], 'notation' => '13/7', 'pos' => ['points' => []]],
            ['seq' => 3, 'ord' => 9, 'player' => 'white', 'kind' => 'end', 'winner' => 'white', 'points' => 2, 'cube_value' => 2],
        ];
        foreach ($rows as $r) {
            MatchMove::create(array_merge(['room_id' => 1, 'room_code' => $code, 'game_no' => 1], $r));
        }
    }

    public function test_buildmat_produces_gnubg_mat_with_moves_cube_and_outcome(): void
    {
        $this->seedGame('TST01');
        $mat = MatchMove::buildMat('TST01', ['matchLength' => 5, 'whiteName' => 'W', 'blackName' => 'B']);

        $this->assertStringContainsString('5 point match', $mat);
        $this->assertStringContainsString('31: 8/5 6/5', $mat);       // beyaz hamle + kanonik zar
        $this->assertStringContainsString('32: 24/23 13/11', $mat);   // siyah hamle
        $this->assertStringContainsString('Doubles => 2', $mat);      // küp teklifi
        $this->assertStringContainsString('Takes', $mat);             // küp kabul
        $this->assertStringContainsString('61: 13/7', $mat);          // katlama sonrası hamle
        $this->assertStringContainsString('Wins 2 points', $mat);     // sonuç (cube 2 × 1)
    }

    public function test_buildlog_shape_for_pr_and_cube(): void
    {
        $this->seedGame('TST02');
        $log = MatchMove::buildLog('TST02');

        // 'end' hariç: 3 hamle + 2 küp = 5 girdi.
        $this->assertCount(5, $log);
        $moves = array_values(array_filter($log, fn ($e) => ! isset($e['cube'])));
        $cubes = array_values(array_filter($log, fn ($e) => isset($e['cube'])));
        $this->assertCount(3, $moves);
        $this->assertCount(2, $cubes);
        $this->assertSame('double', $cubes[0]['cube']['chosen']);
        $this->assertSame('take', $cubes[1]['cube']['chosen']);
        $this->assertArrayHasKey('pos', $moves[0]);
        $this->assertArrayHasKey('playedSteps', $moves[0]);
    }

    public function test_exists_for_room(): void
    {
        $this->assertFalse(MatchMove::existsForRoom('NOPE0'));
        $this->seedGame('TST03');
        $this->assertTrue(MatchMove::existsForRoom('TST03'));
    }

    public function test_matchresult_prefers_server_source_over_client_log(): void
    {
        $this->seedGame('SRV01');
        $user = \App\Models\User::factory()->create();
        // İstemci logu KASITLI BOZUK ("CROT") — sunucu kaynağı (match_moves) tercih edilmeli.
        $mr = \App\Models\MatchResult::create([
            'user_id' => $user->id, 'won' => true, 'opponent_rating' => 1000, 'rating_before' => 1000,
            'rating_after' => 1016, 'delta' => 16, 'room_code' => 'SRV01', 'match_length' => 5,
            'log' => json_encode(['hc' => 'white', 'log' => [['player' => 'white', 'notation' => 'CROT', 'seq' => 0]]]),
        ]);

        // analysisLog: sunucu buildLog (CROT DEĞİL, gerçek hamleler).
        $log = $mr->analysisLog();
        $notations = array_column(array_filter($log, fn ($e) => ! isset($e['cube'])), 'notation');
        $this->assertContains('8/5 6/5', $notations);
        $this->assertNotContains('CROT', $notations);

        // matText: sunucu .mat (gnubg), Wins satırı + hamleler; bozuk client logu KULLANILMAZ.
        $mat = $mr->matText();
        $this->assertStringContainsString('8/5 6/5', $mat);
        $this->assertStringContainsString('Wins 2 points', $mat);
        $this->assertStringNotContainsString('CROT', $mat);
    }
}
