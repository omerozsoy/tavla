<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// toClient().pot: oynanan GERÇEK tutar. Yüzde-bahis (bet_pct) maçta iki oyuncunun snapshot
// bahsinin KÜÇÜĞÜ (küçük limit belirler); sabit-stake'te = stake. Ham snapshot sızmamalı.
class RoomPotTest extends TestCase
{
    use RefreshDatabase;

    public function test_pct_pot_is_min_of_snapshot(): void
    {
        $room = Room::create([
            'code' => 'POTMN',
            'p1_token' => 'A', 'p1_name' => 'A', 'p1_user_id' => 8,
            'p2_token' => 'B', 'p2_name' => 'B', 'p2_user_id' => 156,
            'status' => 'playing', 'version' => 0, 'target' => 7,
            'mode' => 'ranked', 'bet_pct' => 10, 'stake' => 0,
            'server_match' => ['pct_stake_snapshot' => ['8' => 4670, '156' => 35055]],
        ]);

        $c = $room->toClient();
        $this->assertSame(4670, $c['pot']); // min(4670, 35055)
        // ham snapshot istemciye SIZMAMALI
        $this->assertArrayNotHasKey('pct_stake_snapshot', (array) ($c['server_match'] ?? []));
    }

    public function test_fixed_stake_pot_equals_stake(): void
    {
        $room = Room::create([
            'code' => 'POTFX',
            'p1_token' => 'A', 'p1_name' => 'A',
            'status' => 'playing', 'version' => 0, 'target' => 1,
            'mode' => 'ranked', 'bet_pct' => 0, 'stake' => 250,
        ]);

        $this->assertSame(250, $room->toClient()['pot']);
    }
}
