<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// C1: Kullanıcı başına TEK aktif (playing) bahisli maç. Eşzamanlı bahisli maçlar coin
// drain/shortchange exploit'i açıyordu; oynanan bahisli maç varken yeni bahisli arama reddedilir.
class RoomStakeGuardTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n, int $coins = 1000): User
    {
        $u = User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n, 'email' => $n.'@e.com', 'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins;
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    private function playingStakedRoom(User $u, string $code = 'PLAY1'): Room
    {
        return Room::create([
            'code' => $code, 'p1_token' => 'ptok', 'p1_user_id' => $u->id, 'p1_name' => $u->nickname,
            'p2_token' => 'p2tok', 'p2_user_id' => null, 'p2_name' => 'X',
            'status' => 'playing', 'stake' => 100, 'bet_pct' => 0, 'target' => 1, 'version' => 1,
        ]);
    }

    public function test_cannot_start_second_staked_match_while_playing(): void
    {
        $a = $this->user('stakeA');
        $this->playingStakedRoom($a); // A zaten bahisli maçta (playing)

        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'newtok', 'name' => 'stakeA', 'stake' => 100, 'targets' => [1],
        ])->assertStatus(422); // C1: reddedilmeli
    }

    public function test_free_match_allowed_while_in_staked_game(): void
    {
        // Bahisli maçtayken BAHİSSİZ (stake=0) oyun serbest — guard yalnız bahisliye.
        $a = $this->user('stakeB');
        $this->playingStakedRoom($a, 'PLAY2');

        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'freetok', 'name' => 'stakeB', 'stake' => 0, 'targets' => [1],
        ])->assertOk(); // bahissiz -> serbest
    }

    public function test_staked_match_allowed_when_no_active_staked_game(): void
    {
        // Aktif bahisli maçı olmayan kullanıcı bahisli arama başlatabilir (havuza girer).
        $a = $this->user('stakeC');

        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'ctok', 'name' => 'stakeC', 'stake' => 100, 'targets' => [1],
        ])->assertOk();
    }
}
