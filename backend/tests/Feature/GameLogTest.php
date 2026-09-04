<?php

namespace Tests\Feature;

use App\Models\GameLog;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Maç kaydı (hamle+zar): istemci slot-kolon yazımı, meta idempotency, online oda zenginleştirme,
// iki oyuncunun turlarının seq'e göre birleştirilmesi.
class GameLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_log_and_stores_own_slot_events(): void
    {
        $res = $this->postJson('/api/game-logs', [
            'uid' => 'ABC123',
            'slot' => 'p1',
            'mode' => 'pvb',
            'target' => 1,
            'p1_name' => 'Ömer',
            'p2_name' => 'Bilgisayar',
            'status' => 'playing',
            'events' => [
                ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '6-5', 'm' => '24/18 13/8'],
                ['g' => 1, 's' => 2, 'p' => 'W', 'd' => '3-1', 'm' => '8/5 6/5'],
            ],
        ]);
        $res->assertOk()->assertJson(['ok' => true]);

        $log = GameLog::where('uid', 'ABC123')->firstOrFail();
        $this->assertSame('pvb', $log->mode);
        $this->assertSame('Ömer', $log->p1_name);
        $this->assertCount(2, $log->p1_events);
        $this->assertNull($log->p2_events);
        $this->assertSame('playing', $log->status);
    }

    public function test_two_players_write_separate_columns_and_merge_by_seq(): void
    {
        // p1 kendi turlarını (seq çift), p2 kendi turlarını (seq tek) yazar.
        $this->postJson('/api/game-logs', [
            'uid' => 'ROOM01', 'slot' => 'p1', 'mode' => 'online', 'target' => 3,
            'events' => [
                ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '6-5', 'm' => '24/18 13/8'],
                ['g' => 1, 's' => 2, 'p' => 'W', 'd' => '4-2', 'm' => '13/9 13/11'],
            ],
        ])->assertOk();

        $this->postJson('/api/game-logs', [
            'uid' => 'ROOM01', 'slot' => 'p2', 'mode' => 'online', 'target' => 3,
            'status' => 'finished', 'winner' => 'white', 'score' => ['white' => 3, 'black' => 1],
            'events' => [
                ['g' => 1, 's' => 1, 'p' => 'B', 'd' => '5-3', 'm' => '12/17 12/15'],
            ],
        ])->assertOk();

        $log = GameLog::where('uid', 'ROOM01')->firstOrFail();
        $merged = $log->mergedTurns();
        $this->assertCount(3, $merged);
        // seq sırası: 0(W), 1(B), 2(W)
        $this->assertSame(['W', 'B', 'W'], array_column($merged, 'p'));
        $this->assertSame('finished', $log->status);
        $this->assertSame('white', $log->winner);
        $this->assertSame(['white' => 3, 'black' => 1], $log->score);
    }

    public function test_online_mode_enriches_from_room(): void
    {
        Room::create([
            'code' => 'RM999', 'p1_token' => 't1', 'p2_token' => 't2',
            'p1_name' => 'Alice', 'p2_name' => 'Bob',
            'p1_user_id' => 5, 'p2_user_id' => 9, 'status' => 'playing',
        ]);

        $this->postJson('/api/game-logs', [
            'uid' => 'RM999', 'slot' => 'p1', 'mode' => 'online', 'target' => 1,
            'p1_name' => 'x', 'p2_name' => 'y',
            'events' => [['g' => 1, 's' => 0, 'p' => 'W', 'd' => '6-6', 'm' => 'bar/19']],
        ])->assertOk();

        $log = GameLog::where('uid', 'RM999')->firstOrFail();
        $this->assertSame('Alice', $log->p1_name);
        $this->assertSame('Bob', $log->p2_name);
        $this->assertSame(5, (int) $log->p1_user_id);
        $this->assertSame(9, (int) $log->p2_user_id);
    }

    public function test_rejects_invalid_uid(): void
    {
        $this->postJson('/api/game-logs', [
            'uid' => 'bad uid!', 'slot' => 'p1', 'mode' => 'pvb', 'target' => 1, 'events' => [],
        ])->assertStatus(422);
    }

    public function test_cube_and_end_events_order_and_dedupe(): void
    {
        // Aynı seq'te: kup(o=-3) < hamle(o=0) < bitiş(o=9). Bitiş iki kez yazılırsa tekilleşir.
        $this->postJson('/api/game-logs', [
            'uid' => 'CUBE01', 'slot' => 'p1', 'mode' => 'pvb', 'target' => 1,
            'events' => [
                ['g' => 1, 's' => 4, 'p' => 'W', 'd' => '', 'm' => 'Beyaz · Normal · 1p', 'o' => 9, 'k' => 'end'],
                ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '6-5', 'm' => '24/18 13/8', 'o' => 0],
                ['g' => 1, 's' => 0, 'p' => 'W', 'd' => '', 'm' => 'Katla → 2', 'o' => -3, 'k' => 'cube'],
                // Bitiş olayının ikinci istemci kopyası (dedupe edilmeli)
                ['g' => 1, 's' => 4, 'p' => 'W', 'd' => '', 'm' => 'Beyaz · Normal · 1p', 'o' => 9, 'k' => 'end'],
            ],
        ])->assertOk();

        $merged = GameLog::where('uid', 'CUBE01')->firstOrFail()->mergedTurns();
        $this->assertCount(3, $merged); // 4 event -> bitiş tekilleşti
        $this->assertSame('cube', $merged[0]['k']);      // önce kup (o=-3)
        $this->assertSame('24/18 13/8', $merged[1]['m']); // sonra hamle (o=0)
        $this->assertSame('end', $merged[2]['k']);       // en son bitiş (o=9)
    }

    public function test_prune_deletes_old_pvb_only(): void
    {
        $mk = function (string $uid, string $mode, int $daysAgo) {
            $g = GameLog::create(['uid' => $uid, 'mode' => $mode, 'target' => 1]);
            $g->created_at = now()->subDays($daysAgo);
            $g->save();
        };
        $mk('OLDPVB', 'pvb', 120);
        $mk('NEWPVB', 'pvb', 10);
        $mk('OLDONL', 'online', 120);

        $this->artisan('gamelogs:prune --days=90')->assertExitCode(0);

        $this->assertNull(GameLog::where('uid', 'OLDPVB')->first());   // eski pvb silindi
        $this->assertNotNull(GameLog::where('uid', 'NEWPVB')->first()); // yeni pvb kaldı
        $this->assertNotNull(GameLog::where('uid', 'OLDONL')->first()); // online korundu
    }
}
