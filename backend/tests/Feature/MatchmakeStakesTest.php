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

    // HEARTBEAT: arayan beklerken poll ettigi surece (updated_at tazelenir) havuzda/listede kalir;
    // poll kesilince (updated_at donar) 2 dk sonra cleanupStale siler ve seekers'tan duser.
    public function test_active_seeker_survives_while_stale_one_is_removed(): void
    {
        $a = $this->makeUser('alice', 100000);
        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [0], 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);
        $room = \App\Models\Room::where('p1_user_id', $a->id)->where('status', 'mm_waiting')->firstOrFail();

        // Arayan poll etmeyi birakti: son yasam belirtisi (updated_at) 3 dk once. created_at TAZE
        // birakilir -> eski created_at mantigi bu odayi tutardi; artik updated_at belirler.
        $room->forceFill(['updated_at' => now()->subMinutes(3), 'created_at' => now()])->saveQuietly();

        // Baska biri /matchmaking'e girer (cleanupStale tetiklenir) -> bayat oda silinmeli.
        $b = $this->makeUser('bob', 100000);
        Sanctum::actingAs($b);
        $this->postJson('/api/matchmaking', [
            'token' => 'B', 'name' => 'B', 'stakes' => [777], 'targets' => [1], 'time_control' => 'normal',
        ])->assertOk();
        $this->assertDatabaseMissing('rooms', ['id' => $room->id]);

        // Canli (yeni updated_at) arayan hem seekers listesinde kalmali hem cleanup'a dayanmali.
        $c = $this->makeUser('carol', 100000);
        Sanctum::actingAs($c);
        $this->postJson('/api/matchmaking', [
            'token' => 'C', 'name' => 'C', 'stakes' => [0], 'targets' => [9], 'time_control' => 'normal', // target kesismez -> eslesmez
        ])->assertOk()->assertJson(['matched' => false]);
        $cRoom = \App\Models\Room::where('p1_user_id', $c->id)->where('status', 'mm_waiting')->firstOrFail();

        Sanctum::actingAs($b);
        $res = $this->getJson('/api/seekers')->assertOk();
        $ids = collect($res->json('seekers'))->where('kind', 'seeking')->pluck('id')->all();
        $this->assertContains($c->id, $ids);     // canli arayan listede
        $this->assertNotContains($a->id, $ids);  // bayat arayan listede DEGIL
        $this->assertDatabaseHas('rooms', ['id' => $cRoom->id]); // canli oda silinmedi
    }
}
