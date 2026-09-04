<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Faz 2 — açılış/başlayan (Adım C), Crawford, timeout forfeit (server_match otoritesi).
 */
class RoomServerAuthTest extends TestCase
{
    use RefreshDatabase;

    private function room(array $sm = [], ?array $state = null, int $target = 1): Room
    {
        return Room::create([
            'code' => 'AUTHX',
            'p1_token' => 'p1', 'p1_name' => 'A', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 0, 'target' => $target,
            'authoritative' => true,
            'server_state' => $state,
            'server_match' => $sm ?: null,
        ]);
    }

    // ---- AÇILIŞ (Adım C) ----
    public function test_first_roll_is_fair_opening(): void
    {
        $this->room(); // server_state/server_match yok -> roll lazy-init + açılış
        $res = $this->postJson('/api/rooms/AUTHX/roll', ['token' => 'p1'])->assertOk();
        $res->assertJsonPath('opening', true);
        $dice = $res->json('dice');
        $this->assertCount(2, $dice);
        $this->assertNotSame($dice[0], $dice[1]);          // açılış asla berabere/çift
        $this->assertSame($dice[0], max($dice[0], $dice[1])); // büyük önce
        $this->assertContains($res->json('starter'), ['white', 'black']);

        $room = Room::first()->fresh();
        $this->assertTrue($room->server_match['opened']);
        $this->assertSame($res->json('starter'), $room->server_state['turn']);
    }

    public function test_opening_is_deterministic_and_idempotent(): void
    {
        $this->room();
        $a = $this->postJson('/api/rooms/AUTHX/roll', ['token' => 'p1'])->json('dice');
        $starter = Room::first()->fresh()->server_match['opened'] ? Room::first()->fresh()->server_state['turn'] : null;
        // Başlayan tekrar isterse AYNI açılış zarı (reused); açılış bir daha üretilmez.
        $starterToken = $starter === 'white' ? 'p1' : 'p2';
        $b = $this->postJson('/api/rooms/AUTHX/roll', ['token' => $starterToken])->assertOk();
        $this->assertSame($a, $b->json('dice'));
    }

    // ---- CRAWFORD ----
    public function test_reaching_one_away_triggers_crawford_and_blocks_cube(): void
    {
        // target 4, beyaz 2. Siyah resign -> beyaz 3 = target-1 -> SONRAKİ oyun Crawford.
        $sm = ['target' => 4, 'score' => ['white' => 2, 'black' => 0], 'gameNo' => 1, 'done' => false,
            'winner' => null, 'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
            'crawford' => false, 'crawfordDone' => false, 'opened' => true];
        $this->room($sm, Backgammon::initialState(), 4);

        $this->postJson('/api/rooms/AUTHX/resign', ['token' => 'p2'])->assertOk()->assertJsonPath('match_done', false);
        $room = Room::first()->fresh();
        $this->assertSame(3, $room->server_match['score']['white']);
        $this->assertTrue($room->server_match['crawford']); // Crawford oyunu

        // Crawford oyununda küp YASAK (beyazın sırası, tahta taze).
        $this->postJson('/api/rooms/AUTHX/cube/offer', ['token' => 'p1'])->assertStatus(409);
    }

    public function test_after_crawford_game_doubling_resumes(): void
    {
        // Crawford oyunu şu an oynanıyor; beyaz 3/4. Beyaz resign -> siyah kazanır (1), maç sürer.
        // wasCrawford=true -> crawfordDone=true, crawford=false -> küp tekrar serbest.
        $sm = ['target' => 4, 'score' => ['white' => 3, 'black' => 0], 'gameNo' => 2, 'done' => false,
            'winner' => null, 'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
            'crawford' => true, 'crawfordDone' => false, 'opened' => true];
        $this->room($sm, Backgammon::initialState(), 4);

        $this->postJson('/api/rooms/AUTHX/resign', ['token' => 'p1'])->assertOk()->assertJsonPath('match_done', false);
        $room = Room::first()->fresh();
        $this->assertSame(1, $room->server_match['score']['black']);
        $this->assertFalse($room->server_match['crawford']);
        $this->assertTrue($room->server_match['crawfordDone']);

        // Küp tekrar teklif edilebilir (post-Crawford). Beyazın sırası (yeni oyun, opened).
        $room->server_match = array_merge($room->server_match, ['opened' => true]);
        $room->server_state = array_merge(Backgammon::initialState(), ['turn' => 'white']);
        $room->save();
        $this->postJson('/api/rooms/AUTHX/cube/offer', ['token' => 'p1'])->assertOk();
    }
}
