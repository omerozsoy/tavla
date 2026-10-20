<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// HEDEFLI katilim: "Oyun Arayanlar"da birine "eslesme" dendiginde opponent_id ile YALNIZ o
// oyuncuyla eslesilir. Havuzda daha eski uygun bir arayan olsa bile araya 3. sahis GIRMEZ;
// secilen oyuncu gittiyse havuza DUSULMEZ (istek net 409 doner).
class MatchmakeTargetedTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick): User
    {
        $u = User::create([
            'first_name' => $nick,
            'last_name' => 'T',
            'country' => '',
            'nickname' => $nick,
            'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->coins = 100000;
        $u->rating = 1500;
        $u->email_verified_at = now();
        $u->save();

        return $u;
    }

    public function test_targeted_join_matches_clicked_seeker_not_oldest_in_pool(): void
    {
        $bob = $this->makeUser('bob');     // havuza ONCE girer (en eski), uzunluk [3]
        $carol = $this->makeUser('carol'); // sonra girer, uzunluk [1]
        $alice = $this->makeUser('alice');

        // Bob [3], carol [1] -> birbirleriyle KESISMEZ (ikisi de havuzda bekler). Alice [1,3]
        // her ikisiyle de kesisir: hedefsiz olsa en eski (bob) secilirdi.
        Sanctum::actingAs($bob);
        $this->postJson('/api/matchmaking', [
            'token' => 'B', 'name' => 'B', 'stakes' => [0], 'targets' => [3], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);
        Sanctum::actingAs($carol);
        $this->postJson('/api/matchmaking', [
            'token' => 'C', 'name' => 'C', 'stakes' => [0], 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // Alice carol'u SECER. Hedefsiz olsa en eski (bob) secilirdi; opponent_id ile carol'la eslesmeli.
        Sanctum::actingAs($alice);
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [0], 'targets' => [1, 3], 'time_control' => 'normal',
            'opponent_id' => $carol->id,
        ])->assertOk()
            ->assertJson(['matched' => true, 'slot' => 'p2'])
            ->assertJsonPath('room.p1_user_id', $carol->id);

        // Bob'un odasi dokunulmadan bekliyor (araya girmedi).
        $this->assertDatabaseHas('rooms', [
            'p1_user_id' => $bob->id, 'status' => 'mm_waiting',
        ]);
    }

    public function test_targeted_join_fails_without_pooling_when_opponent_gone(): void
    {
        $alice = $this->makeUser('alice');
        $ghostId = 999999; // bekleyen odasi olmayan oyuncu

        Sanctum::actingAs($alice);
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [0], 'targets' => [1], 'time_control' => 'normal',
            'opponent_id' => $ghostId,
        ])->assertStatus(409);

        // KRITIK: istek sahibine havuz odasi ACILMADI -> rastgele biriyle eslesme riski yok.
        $this->assertDatabaseCount('rooms', 0);
        $this->assertFalse(Room::where('p1_user_id', $alice->id)->exists());
    }
}
