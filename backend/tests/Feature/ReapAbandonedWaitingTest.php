<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Room::reapAbandonedWaiting: terk edilmiş ÜCRETSİZ 'waiting' odaları siler;
// ekonomik (stake/bet_pct), taze, rakipli, mm_waiting ve playing odalara ASLA dokunmaz.
class ReapAbandonedWaitingTest extends TestCase
{
    use RefreshDatabase;

    private function room(array $attrs): Room
    {
        $staleMin = $attrs['stale_min'] ?? null;
        unset($attrs['stale_min']);
        $room = Room::create(array_merge([
            'status' => 'waiting', 'stake' => 0, 'bet_pct' => 0,
            'p1_token' => 'tok1', 'p1_user_id' => 1, 'p1_name' => 'P1', 'version' => 0,
        ], $attrs));
        if ($staleMin !== null) {
            DB::table('rooms')->where('id', $room->id)
                ->update(['updated_at' => now()->subMinutes($staleMin)]);
        }

        return $room;
    }

    public function test_deletes_only_abandoned_free_waiting_rooms(): void
    {
        $staleFree = $this->room(['code' => 'STALE', 'stale_min' => 30]);                 // SİLİNMELİ
        $fresh     = $this->room(['code' => 'FRESH']);                                    // taze -> kalmalı
        $staked    = $this->room(['code' => 'STAKE', 'stake' => 100, 'stale_min' => 30]); // ekonomik -> kalmalı
        $pctBet    = $this->room(['code' => 'PCTBT', 'bet_pct' => 50, 'stale_min' => 30]);// ekonomik -> kalmalı
        $hasOpp    = $this->room(['code' => 'OPPIN', 'p2_token' => 'tok2', 'stale_min' => 30]);       // rakip var -> kalmalı
        $mmPool    = $this->room(['code' => 'MMWAI', 'status' => 'mm_waiting', 'stale_min' => 30]);   // farklı status -> kalmalı
        $playing   = $this->room(['code' => 'PLAYG', 'status' => 'playing', 'p2_token' => 'tok2', 'stale_min' => 30]); // kalmalı

        $deleted = Room::reapAbandonedWaiting(15);

        $this->assertSame(1, $deleted);
        $this->assertNull(Room::find($staleFree->id));
        foreach ([$fresh, $staked, $pctBet, $hasOpp, $mmPool, $playing] as $r) {
            $this->assertNotNull(Room::find($r->id), $r->code.' silinmemeli');
        }
    }

    public function test_batching_deletes_all_beyond_limit(): void
    {
        for ($i = 0; $i < 7; $i++) {
            $this->room(['code' => 'B'.$i.'XYZ', 'stale_min' => 30]);
        }
        $deleted = Room::reapAbandonedWaiting(15, 3); // limit 3 -> turlar: 3+3+1

        $this->assertSame(7, $deleted);
        $this->assertSame(0, Room::where('status', 'waiting')->count());
    }
}
