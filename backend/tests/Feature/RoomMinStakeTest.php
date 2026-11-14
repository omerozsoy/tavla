<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// MİNİMUM EFEKTİF BAHİS: yüzde bahiste düşük bakiyenin %'si 0'a (ya da min_stake altına) yuvarlanıp
// "bedava para maçı" açtığı açık kapandı. config('game.min_stake')=10 varsayılan. floor(bakiye×%/100)
// min_stake altındaysa HİÇBİR giriş noktası (create / matchmaking / join / enter) maçı kurdurmaz.
class RoomMinStakeTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick, int $coins): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com', 'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins;
        $u->rating = 1500;
        $u->email_verified_at = now();
        $u->save();

        return $u;
    }

    public function test_matchmaking_pct_create_rejected_when_effective_stake_below_min(): void
    {
        // 90 coin × %10 = 9 < 10 (min) -> açık: eskiden kurulabiliyordu, artık 422.
        $a = $this->makeUser('poor', 90);
        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [0], 'bet_pct' => 10, 'targets' => [1], 'time_control' => 'normal',
        ])->assertStatus(422);
        $this->assertDatabaseCount('rooms', 0);
    }

    public function test_matchmaking_pct_create_allowed_at_min(): void
    {
        // 100 coin × %10 = 10 = min -> tam sınırda geçer.
        $a = $this->makeUser('ok', 100);
        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [0], 'bet_pct' => 10, 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);
    }

    public function test_matchmaking_does_not_pair_when_one_side_below_min(): void
    {
        // Zengin arayan bekler; fakir (effective 9) para araması yapamaz (create guard 422) ->
        // zengini kapamaz, zengin hâlâ bekliyor (sub-min oyuncu asla potlu maça giremez).
        $rich = $this->makeUser('rich', 100000);
        Sanctum::actingAs($rich);
        $this->postJson('/api/matchmaking', [
            'token' => 'R', 'name' => 'R', 'stakes' => [0], 'bet_pct' => 10, 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        $poor = $this->makeUser('poor', 90);
        Sanctum::actingAs($poor);
        $this->postJson('/api/matchmaking', [
            'token' => 'P', 'name' => 'P', 'stakes' => [0], 'bet_pct' => 10, 'targets' => [1], 'time_control' => 'normal',
        ])->assertStatus(422);

        // Zengin arayan hâlâ bekliyor (fakir onu kapmadı), fakir oda oluşturmadı.
        $this->assertDatabaseHas('rooms', ['p1_user_id' => $rich->id, 'status' => 'mm_waiting']);
        $this->assertDatabaseMissing('rooms', ['p1_user_id' => $poor->id]);
    }

    public function test_invite_room_create_rejected_when_host_below_min(): void
    {
        // Davet odası min %10 potlu -> 90 coinlik host efektif 9 < 10 -> oda hiç kurulmaz.
        $a = $this->makeUser('poor', 90);
        Sanctum::actingAs($a);
        $this->postJson('/api/rooms', [
            'token' => 'A', 'name' => 'A', 'bet_pct' => 10, 'target' => 1,
        ])->assertStatus(422);
        $this->assertDatabaseCount('rooms', 0);
    }

    public function test_join_rejected_when_joiner_below_min(): void
    {
        $host = $this->makeUser('host', 100000);
        $room = Room::create([
            'code' => 'MINJN', 'p1_token' => 'H', 'p1_name' => 'H', 'p1_user_id' => $host->id,
            'status' => 'waiting', 'mode' => 'friendly', 'bet_pct' => 10, 'stake' => 0, 'target' => 1, 'version' => 0,
        ]);

        $poor = $this->makeUser('poor', 90); // effective 9 < 10
        Sanctum::actingAs($poor);
        $this->postJson('/api/rooms/MINJN/join', ['token' => 'P', 'name' => 'P'])
            ->assertStatus(422);

        // Oda hâlâ rakipsiz 'waiting' (maç başlamadı).
        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'status' => 'waiting', 'p2_token' => null]);
    }
}
