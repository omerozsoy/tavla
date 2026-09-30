<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActiveMoneyClaimTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_unique_claim_allows_two_players_in_one_room_but_one_room_per_user(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create();
        $roomA = Room::create([
            'code' => 'CLMA1', 'p1_token' => 'a', 'p1_name' => 'P1', 'status' => 'playing',
            'mode' => 'ranked', 'stake' => 10, 'version' => 0,
        ]);
        $roomB = Room::create([
            'code' => 'CLMB1', 'p1_token' => 'b', 'p1_name' => 'P1', 'status' => 'playing',
            'mode' => 'ranked', 'stake' => 10, 'version' => 0,
        ]);

        $this->assertTrue(Room::claimActiveMoneySlot($p1->id, $roomA->id));
        $this->assertTrue(Room::claimActiveMoneySlot($p2->id, $roomA->id));
        $this->assertTrue(Room::claimActiveMoneySlot($p1->id, $roomA->id));
        $this->assertFalse(Room::claimActiveMoneySlot($p1->id, $roomB->id));
        $this->assertDatabaseCount('active_money_match_claims', 2);
    }

    public function test_release_allows_user_to_claim_next_money_room(): void
    {
        $user = User::factory()->create();
        $roomA = Room::create([
            'code' => 'CLMR1', 'p1_token' => 'a', 'p1_name' => 'P1', 'status' => 'playing',
            'mode' => 'ranked', 'stake' => 10, 'version' => 0,
        ]);
        $roomB = Room::create([
            'code' => 'CLMR2', 'p1_token' => 'b', 'p1_name' => 'P1', 'status' => 'playing',
            'mode' => 'ranked', 'stake' => 10, 'version' => 0,
        ]);

        $this->assertTrue(Room::claimActiveMoneySlot($user->id, $roomA->id));
        Room::releaseActiveMoneyClaims($roomA->id);

        $this->assertTrue(Room::claimActiveMoneySlot($user->id, $roomB->id));
        $this->assertDatabaseHas('active_money_match_claims', [
            'user_id' => $user->id,
            'room_id' => $roomB->id,
        ]);
    }

    public function test_stale_claim_for_finished_room_self_heals(): void
    {
        // settle()/release atlanarak biten oda claim satırını sızdırırsa (rooms<->claims diverjansı),
        // kullanıcı yeni maça giremeyip matchmaking'de 500 alıyordu. Bayat claim (oda artık aktif değil)
        // otomatik temizlenmeli ve yeni oda claim edilebilmeli.
        $user = User::factory()->create();
        $stale = Room::create([
            'code' => 'STAL1', 'p1_token' => 'a', 'p1_name' => 'P1', 'status' => 'finished',
            'mode' => 'ranked', 'stake' => 10, 'version' => 0, 'settled' => true,
        ]);
        $fresh = Room::create([
            'code' => 'FRSH1', 'p1_token' => 'b', 'p1_name' => 'P1', 'status' => 'playing',
            'mode' => 'ranked', 'stake' => 10, 'version' => 0,
        ]);

        $this->assertTrue(Room::claimActiveMoneySlot($user->id, $stale->id));
        // Oda bitti ama release çağrılmadı -> claim sızdı; yeni maça giriş self-heal ile geçmeli.
        $this->assertTrue(Room::claimActiveMoneySlot($user->id, $fresh->id));
        $this->assertDatabaseMissing('active_money_match_claims', [
            'user_id' => $user->id, 'room_id' => $stale->id,
        ]);
        $this->assertDatabaseHas('active_money_match_claims', [
            'user_id' => $user->id, 'room_id' => $fresh->id,
        ]);
    }
}
