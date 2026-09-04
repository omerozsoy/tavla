<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Support\Backgammon;
use App\Support\RoomResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Sunucu-otoriter MAÇ (Faz 3): puan (gammon/backgammon), skor otoritesi, settle/RoomResult.
class ServerMatchTest extends TestCase
{
    use RefreshDatabase;

    // Sunucu başlangıç tahtası src/engine/board.ts initialState ile BİREBİR olmalı (validator =
    // istemci motoru bu konvansiyonu bekler). TERS dizi = hamle reddi + tahta ters görünür.
    public function test_initial_state_matches_client_engine(): void
    {
        $this->assertSame(
            [-2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2],
            Backgammon::initialState()['points'],
        );
    }

    // ---- gamePoints ----
    public function test_game_points_normal(): void
    {
        $s = Backgammon::initialState();
        $s['off'] = ['white' => 15, 'black' => 3]; // kaybeden 3 topladı -> normal
        $this->assertSame(1, Backgammon::gamePoints($s, 'white'));
    }

    public function test_game_points_gammon(): void
    {
        $s = Backgammon::initialState();
        $s['points'] = array_fill(0, 24, 0);
        $s['points'][12] = -15;            // siyahın 15 taşı orta sahada (kazananın evi/bar DEĞİL)
        $s['off'] = ['white' => 15, 'black' => 0];
        $s['bar'] = ['white' => 0, 'black' => 0];
        $this->assertSame(2, Backgammon::gamePoints($s, 'white'));
    }

    public function test_game_points_backgammon_in_home(): void
    {
        $s = Backgammon::initialState();
        $s['points'] = array_fill(0, 24, 0);
        $s['points'][3] = -2;              // siyah taşı BEYAZIN evinde (0..5) -> backgammon
        $s['points'][12] = -13;
        $s['off'] = ['white' => 15, 'black' => 0];
        $s['bar'] = ['white' => 0, 'black' => 0];
        $this->assertSame(3, Backgammon::gamePoints($s, 'white'));
    }

    public function test_game_points_backgammon_on_bar(): void
    {
        $s = Backgammon::initialState();
        $s['points'] = array_fill(0, 24, 0);
        $s['points'][12] = -14;
        $s['off'] = ['white' => 15, 'black' => 0];
        $s['bar'] = ['white' => 0, 'black' => 1]; // bar'da taş -> backgammon
        $this->assertSame(3, Backgammon::gamePoints($s, 'white'));
    }

    // ---- server_match skor otoritesi (move üzerinden) ----
    private function room(int $target = 1): Room
    {
        return Room::create([
            'code' => 'MTCHX',
            'p1_token' => 'p1', 'p1_name' => 'A', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 0, 'target' => $target,
            'authoritative' => true,
            // opened=true: açılış (Adım C) geçildi -> roll normal beyaz eli (bu testler skoru sınar).
            'server_state' => Backgammon::initialState(),
            'server_match' => ['target' => $target, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1, 'done' => false, 'winner' => null, 'opened' => true],
        ]);
    }

    public function test_room_result_authoritative_reads_server_match(): void
    {
        $room = $this->room(3);
        // Sunucu maçı: beyaz 3-1 kazanmış (done)
        $room->server_match = ['target' => 3, 'score' => ['white' => 3, 'black' => 1], 'gameNo' => 3, 'done' => true, 'winner' => 'white'];
        $room->save();

        // p1 (white, user 10) kazandı
        $r1 = RoomResult::resolve($room->fresh(), 10);
        $this->assertSame(['won' => true, 'self' => 3, 'opp' => 1], $r1);
        // p2 (black, user 20) kaybetti
        $r2 = RoomResult::resolve($room->fresh(), 20);
        $this->assertSame(['won' => false, 'self' => 1, 'opp' => 3], $r2);
    }

    public function test_room_result_authoritative_ignores_client_state_when_unfinished(): void
    {
        $room = $this->room(3);
        // İstemci sahte skor POST etmiş olsa bile (state), maç bitmediği için sonuç YOK.
        $room->state = ['match' => ['target' => 3, 'score' => ['white' => 3, 'black' => 0]], 'gameEnd' => ['winner' => 'white']];
        $room->save();
        $this->assertNull(RoomResult::resolve($room->fresh(), 10)); // forge edilemez
    }

    public function test_move_advances_server_match_score(): void
    {
        // Beyaz bir sonraki hamlede 15. taşı toplayıp tek-puanlık maçı bitirecek.
        // validateTurn'ü mock'lamak yerine: winning state döndüren fake validator.
        config()->set('validator.url', 'http://validator.test');
        $room = $this->room(1);
        // roll ile server_state kur
        $this->postJson('/api/rooms/MTCHX/roll', ['token' => 'p1'])->assertOk();

        // Validator: beyaz 15 taş topladı (oyun bitti) -> sıra black
        $won = Backgammon::initialState();
        $won['off'] = ['white' => 15, 'black' => 5];
        $won['turn'] = 'black';
        $won['dice'] = [];
        \Illuminate\Support\Facades\Http::fake([
            'validator.test/validate' => \Illuminate\Support\Facades\Http::response(['valid' => true, 'state' => $won]),
        ]);

        $res = $this->postJson('/api/rooms/MTCHX/move', ['token' => 'p1', 'steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])->assertOk();
        $res->assertJsonPath('winner', 'white')->assertJsonPath('match_done', true);
        $res->assertJsonPath('match.score.white', 1)->assertJsonPath('match.winner', 'white');
    }
}
