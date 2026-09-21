<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// #8DZT4: yüzde-bahis (bet_pct) maçı done, ama server_match'te pct_stake_snapshot YOK ->
// settle 500 (Internal Server Error) veriyordu. Bu test gerçek davranışı yakalar.
class SettlePctMissingSnapshotTest extends TestCase
{
    use RefreshDatabase;

    public function test_settle_pct_match_missing_snapshot(): void
    {
        $p1 = User::create([
            'first_name' => 'Omer', 'last_name' => 'T', 'country' => '',
            'nickname' => 'omer', 'email' => 'omer@x.com', 'password' => bcrypt('x'),
        ]);
        $p1->coins = 1000;
        $p1->save();
        $p2 = User::create([
            'first_name' => 'V', 'last_name' => 'C', 'country' => '',
            'nickname' => 'vc', 'email' => 'vc@x.com', 'password' => bcrypt('x'),
        ]);
        $p2->coins = 1000;
        $p2->save();

        Room::create([
            'code' => '8DZT4',
            'p1_token' => 'A', 'p1_name' => 'Omer', 'p1_user_id' => $p1->id,
            'p2_token' => 'B', 'p2_name' => 'V', 'p2_user_id' => $p2->id,
            'status' => 'playing', 'version' => 0, 'target' => 3,
            'mode' => 'ranked', 'bet_pct' => 10, 'authoritative' => true,
            // pct_stake_snapshot YOK (canlıda kaybolmuş durumu birebir):
            'server_match' => [
                'target' => 3, 'score' => ['white' => 3, 'black' => 2], 'gameNo' => 2,
                'done' => true, 'winner' => 'white', 'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
                'crawford' => false, 'crawfordDone' => true, 'opened' => true, 'turns' => 0,
            ],
        ]);

        Sanctum::actingAs($p1);
        $res = $this->postJson('/api/rooms/8DZT4/settle', ['token' => 'A', 'won' => true]);
        // 500 OLMAMALI (crash). Snapshot yoksa pending/409 (idempotent, coin güvenli).
        $this->assertNotSame(500, $res->status(), 'settle asla 500 vermemeli');
        $this->assertSame(409, $res->status()); // snapshot yok -> pending
    }

    // KÖK FIX: yüzde-bahis RÖVANŞI yeni odaya pct_stake_snapshot yazmalı (aksi halde settle 500).
    public function test_rematch_pct_seeds_snapshot(): void
    {
        $p1 = User::create([
            'first_name' => 'Omer', 'last_name' => 'T', 'country' => '',
            'nickname' => 'omer2', 'email' => 'omer2@x.com', 'password' => bcrypt('x'),
        ]);
        $p1->coins = 1000;
        $p1->save();
        $p2 = User::create([
            'first_name' => 'V', 'last_name' => 'C', 'country' => '',
            'nickname' => 'vc2', 'email' => 'vc2@x.com', 'password' => bcrypt('x'),
        ]);
        $p2->coins = 1000;
        $p2->save();

        $room = Room::create([
            'code' => 'RMPCT',
            'p1_token' => 'A', 'p1_name' => 'Omer', 'p1_user_id' => $p1->id,
            'p2_token' => 'B', 'p2_name' => 'V', 'p2_user_id' => $p2->id,
            'status' => 'finished', 'version' => 0, 'target' => 3, 'settled' => true,
            'mode' => 'ranked', 'bet_pct' => 10, 'authoritative' => true,
            'server_match' => ['target' => 3, 'score' => ['white' => 3, 'black' => 1], 'done' => true, 'winner' => 'white'],
        ]);

        Sanctum::actingAs($p1);
        $this->postJson('/api/rooms/RMPCT/rematch', ['token' => 'A', 'accept' => true])->assertOk();
        Sanctum::actingAs($p2);
        $r = $this->postJson('/api/rooms/RMPCT/rematch', ['token' => 'B', 'accept' => true])->assertOk();

        $newCode = $r->json('rematch.code');
        $this->assertNotEmpty($newCode, 'rövanş kodu üretilmeli');
        $new = Room::where('code', $newCode)->firstOrFail();
        $snap = $new->server_match['pct_stake_snapshot'] ?? null;
        $this->assertIsArray($snap, 'yüzde bahis rövanşı snapshot kurmalı');
        // 1000 available × %10 = 100 (her iki oyuncu).
        $this->assertSame(100, (int) $snap[(string) $p1->id]);
        $this->assertSame(100, (int) $snap[(string) $p2->id]);
    }
}
