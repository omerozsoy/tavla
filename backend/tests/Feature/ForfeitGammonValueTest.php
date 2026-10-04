<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-12: para maçında (stake × skor) terk/timeout yalnız küp değerini yazıyordu; gammon/backgammon'da
// olan oyuncu masayı terk ederek kaybını 1×'e indirebiliyordu. Artık pes ile aynı: konum (1/2/3) × küp.
class ForfeitGammonValueTest extends TestCase
{
    use RefreshDatabase;

    private function room(array $serverState, int $cube = 2): array
    {
        $a = User::factory()->create(['coins' => 5000, 'coins_reserved' => 4800]);
        $b = User::factory()->create(['coins' => 5000, 'coins_reserved' => 4800]);
        Room::create([
            'code' => 'FGV01', 'p1_token' => 'tok1', 'p1_user_id' => $a->id, 'p1_name' => 'A',
            'p2_token' => 'tok2', 'p2_user_id' => $b->id, 'p2_name' => 'B',
            'status' => 'playing', 'stake' => 100, 'bet_pct' => 0, 'target' => 1, 'version' => 1, 'settled' => false,
            'escrowed' => true, 'authoritative' => true, 'server_state' => $serverState,
            'server_match' => ['done' => false, 'target' => 1, 'score' => ['white' => 0, 'black' => 0],
                'cube' => ['value' => $cube, 'owner' => null, 'pending' => null], 'crawford' => false],
        ]);

        return [$a, $b];
    }

    private function backgammonForBlack(): array
    {
        // Siyah (kaybeden) hiç toplamadı ve barda taşı var -> backgammon (3).
        $s = \App\Support\Backgammon::initialState();
        $s['bar']['black'] = 1;
        $s['points'][18] = -4;

        return $s;
    }

    public function test_leaving_in_backgammon_position_costs_three_times_cube(): void
    {
        config(['game.commission_pct' => 0]);
        [$a, $b] = $this->room($this->backgammonForBlack(), 2);
        Sanctum::actingAs($b);
        $this->postJson('/api/rooms/FGV01/leave', ['token' => 'tok2'])->assertOk();
        $room = Room::where('code', 'FGV01')->first();
        $this->assertSame('white', $room->server_match['winner']);
        $this->assertSame(6, (int) $room->server_match['score']['white'], 'backgammon(3) × küp(2) = 6');

        Sanctum::actingAs($a);
        $this->postJson('/api/rooms/FGV01/settle', ['token' => 'tok1', 'won' => true])->assertOk();
        $this->assertSame(5600, (int) $a->fresh()->coins, 'stake 100 × 6 = 600');
        $this->assertSame(4400, (int) $b->fresh()->coins);
    }

    public function test_leaving_after_bearing_off_costs_single_cube(): void
    {
        $s = \App\Support\Backgammon::initialState();
        $s['off']['black'] = 1;
        $s['points'][18] = -4;
        $this->room($s, 2);
        Sanctum::actingAs(User::find(Room::where('code', 'FGV01')->value('p2_user_id')));
        $this->postJson('/api/rooms/FGV01/leave', ['token' => 'tok2'])->assertOk();
        $this->assertSame(2, (int) Room::where('code', 'FGV01')->first()->server_match['score']['white']);
    }
}
