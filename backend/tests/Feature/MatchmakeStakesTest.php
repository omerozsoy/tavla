<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Tek Oyun COKLU bahis: oyuncu birden cok tutar secebilir; kesisen tutarla eslesir
// (ortak tutarlardan EN YUKSEGI anlasilir). Kesisim yoksa eslesme olmaz.
class MatchmakeStakesTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick, int $coins): User
    {
        $u = User::create([
            'first_name' => $nick,
            'last_name' => 'T',
            'country' => '',
            'nickname' => $nick,
            'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins;
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    public function test_multi_stake_matches_on_highest_common(): void
    {
        $a = $this->makeUser('alice', 100000);
        $b = $this->makeUser('bob', 100000);

        // A: 100 veya 500 kabul -> havuza girer
        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [100, 500], 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // B: 500 veya 1000 kabul -> A ile 500'de eslesir (ortak tutarlarin en yukseki)
        Sanctum::actingAs($b);
        $this->postJson('/api/matchmaking', [
            'token' => 'B', 'name' => 'B', 'stakes' => [500, 1000], 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk()
            ->assertJson(['matched' => true, 'slot' => 'p2'])
            ->assertJsonPath('room.stake', 500);
    }

    public function test_non_overlapping_stakes_do_not_match(): void
    {
        $a = $this->makeUser('alice', 100000);
        $b = $this->makeUser('bob', 100000);

        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [100], 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // Kesisen tutar yok -> B eslesmez, kendi havuzuna girer
        Sanctum::actingAs($b);
        $this->postJson('/api/matchmaking', [
            'token' => 'B', 'name' => 'B', 'stakes' => [500], 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);
    }

    public function test_insufficient_coins_for_selected_max_rejected(): void
    {
        // Yalniz 300 coin ama en yuksek secilen 500 -> reddedilir (eslesme o tutarda olabilir).
        $a = $this->makeUser('poor', 300);
        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [100, 500], 'targets' => [1], 'time_control' => 'normal',
        ])->assertStatus(422);
    }
}
