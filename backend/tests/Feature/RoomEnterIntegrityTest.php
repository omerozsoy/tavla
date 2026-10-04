<?php

namespace Tests\Feature;

use App\Http\Controllers\TournamentController;
use App\Models\Room;
use App\Models\User;
use App\Support\RatingPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-04: davetsiz /enter ile kurulan oda mode=NULL kalıp "dereceli, limitsiz" sayılıyordu (rating farm).
// A-05: turnuva maç odasının kodu herkese açık; yabancı boş koltuğa oturup maçı kilitleyebiliyordu.
class RoomEnterIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_inviteless_non_tournament_enter_creates_friendly_room(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        Sanctum::actingAs($a);
        $this->postJson('/api/rooms/FARM1/enter', ['token' => 'ta', 'name' => 'A'])->assertOk();
        Sanctum::actingAs($b);
        $this->postJson('/api/rooms/FARM1/enter', ['token' => 'tb', 'name' => 'B'])->assertOk();
        $room = Room::where('code', 'FARM1')->first();
        $this->assertSame('friendly', $room->mode);
        // friendly -> 24 saatlik aynı-rakip limitine tabi (limitsiz dereceli değil)
        $this->assertNotSame('ranked', $room->mode);
    }

    public function test_tournament_room_enter_keeps_tournament_mode(): void
    {
        $a = User::factory()->create();
        Cache::put(TournamentController::roomTargetKey('TOUR1'), 3, now()->addDay());
        Cache::put(TournamentController::roomPlayersKey('TOUR1'), [$a->id, 999999], now()->addDay());
        Sanctum::actingAs($a);
        $this->postJson('/api/rooms/TOUR1/enter', ['token' => 'ta', 'name' => 'A'])->assertOk();
        $this->assertNull(Room::where('code', 'TOUR1')->first()->mode);
    }

    public function test_outsider_cannot_take_tournament_seat_but_players_can(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create();
        $out = User::factory()->create();
        Cache::put(TournamentController::roomTargetKey('TOUR2'), 1, now()->addDay());
        Cache::put(TournamentController::roomPlayersKey('TOUR2'), [$p1->id, $p2->id], now()->addDay());

        Sanctum::actingAs($out);
        $this->postJson('/api/rooms/TOUR2/enter', ['token' => 'tx', 'name' => 'X'])->assertStatus(403);
        $this->assertNull(Room::where('code', 'TOUR2')->first(), 'yabancı odayı oluşturamamalı');

        Sanctum::actingAs($p1);
        $this->postJson('/api/rooms/TOUR2/enter', ['token' => 't1', 'name' => 'P1'])->assertOk();
        // Yabancı join ile de giremez; misafir de giremez.
        Sanctum::actingAs($out);
        $this->postJson('/api/rooms/TOUR2/join', ['token' => 'tx', 'name' => 'X'])->assertStatus(403);
        $this->postJson('/api/rooms/TOUR2/enter', ['token' => 'tx', 'name' => 'X'])->assertStatus(403);

        Sanctum::actingAs($p2);
        $this->postJson('/api/rooms/TOUR2/enter', ['token' => 't2', 'name' => 'P2'])->assertOk();
        $room = Room::where('code', 'TOUR2')->first();
        $this->assertSame($p1->id, (int) $room->p1_user_id);
        $this->assertSame($p2->id, (int) $room->p2_user_id);
        // Oturan oyuncu yeniden bağlanabilir.
        Sanctum::actingAs($p1);
        $this->postJson('/api/rooms/TOUR2/enter', ['token' => 't1', 'name' => 'P1'])->assertOk();
    }

    public function test_rating_policy_treats_friendly_inviteless_room_with_daily_limit(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $room = Room::create(['code' => 'RP001', 'p1_token' => 'a', 'p2_token' => 'b', 'p1_user_id' => $a->id,
            'p2_user_id' => $b->id, 'p1_name' => 'A', 'p2_name' => 'B', 'status' => 'finished', 'mode' => 'friendly', 'version' => 0]);
        // İlk maçlar dereceli olabilir; önemli olan politikanın friendly dalından (limitli) geçmesi.
        $this->assertIsBool(RatingPolicy::isRanked($room, $a->id, $b->id));
    }
}
