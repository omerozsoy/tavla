<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Seviye seçici (Rakip Seviyesi): arayan, oynamak istediği rakip RATING aralığını seçer. Eşleşme
// KARŞILIKLI doğrular: (a) adayın rating'i arayanın [min,max] aralığında, (b) arayanın rating'i
// adayın kayıtlı [min_opp,max_opp] aralığında olmalı. null = o yön serbest (tüm seviyeler).
class MatchmakeLevelRangeTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick, int $rating): User
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
        $u->rating = $rating;
        $u->email_verified_at = now();
        $u->save();

        return $u;
    }

    /** Ortak alanlar: potsuz maç yasak -> bet_pct=10 ile bahisli. */
    private function seek(array $extra): array
    {
        return array_merge([
            'token' => 'T', 'name' => 'T', 'stakes' => [0], 'targets' => [1, 3, 5],
            'time_control' => 'normal', 'bet_pct' => 10,
        ], $extra);
    }

    public function test_matches_when_both_ranges_satisfied(): void
    {
        $host = $this->makeUser('host', 1400);
        $joiner = $this->makeUser('joiner', 1500);

        // Host 1300–1600 rakip istiyor (joiner 1500 ✓).
        Sanctum::actingAs($host);
        $this->postJson('/api/matchmaking', $this->seek([
            'min_rating' => 1300, 'max_rating' => 1600,
        ]))->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);
        $this->assertDatabaseHas('rooms', [
            'p1_user_id' => $host->id, 'min_opp_rating' => 1300, 'max_opp_rating' => 1600,
        ]);

        // Joiner 1200–1500 rakip istiyor (host 1400 ✓). İki yön de sağlanır -> eşleşir.
        Sanctum::actingAs($joiner);
        $this->postJson('/api/matchmaking', $this->seek([
            'min_rating' => 1200, 'max_rating' => 1500,
        ]))->assertOk()
            ->assertJson(['matched' => true, 'slot' => 'p2'])
            ->assertJsonPath('room.p1_user_id', $host->id);
    }

    public function test_no_match_when_joiner_range_excludes_host(): void
    {
        $host = $this->makeUser('host', 1400);
        $joiner = $this->makeUser('joiner', 1500);

        Sanctum::actingAs($host);
        $this->postJson('/api/matchmaking', $this->seek([]))
            ->assertOk()->assertJson(['matched' => false]);

        // Joiner yalnız 1450+ istiyor -> host 1400 aralık DIŞI -> eşleşmez, joiner havuza düşer.
        Sanctum::actingAs($joiner);
        $this->postJson('/api/matchmaking', $this->seek([
            'min_rating' => 1450,
        ]))->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        $this->assertDatabaseHas('rooms', ['p1_user_id' => $host->id, 'status' => 'mm_waiting']);
        $this->assertDatabaseHas('rooms', ['p1_user_id' => $joiner->id, 'status' => 'mm_waiting']);
    }

    public function test_no_match_when_host_range_excludes_joiner(): void
    {
        $host = $this->makeUser('host', 1400);
        $joiner = $this->makeUser('joiner', 1500);

        // Host yalnız 1600+ rakip istiyor -> joiner 1500 adayın aralığı DIŞI.
        Sanctum::actingAs($host);
        $this->postJson('/api/matchmaking', $this->seek([
            'min_rating' => 1600,
        ]))->assertOk()->assertJson(['matched' => false]);

        Sanctum::actingAs($joiner);
        $this->postJson('/api/matchmaking', $this->seek([]))
            ->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        $this->assertDatabaseHas('rooms', ['p1_user_id' => $host->id, 'status' => 'mm_waiting']);
        $this->assertDatabaseHas('rooms', ['p1_user_id' => $joiner->id, 'status' => 'mm_waiting']);
    }

    public function test_matches_when_no_range_all_levels(): void
    {
        $host = $this->makeUser('host', 1000);
        $joiner = $this->makeUser('joiner', 2400); // çok farklı rating ama ikisi de "tüm seviyeler"

        Sanctum::actingAs($host);
        $this->postJson('/api/matchmaking', $this->seek([]))
            ->assertOk()->assertJson(['matched' => false]);
        $this->assertDatabaseHas('rooms', [
            'p1_user_id' => $host->id, 'min_opp_rating' => null, 'max_opp_rating' => null,
        ]);

        Sanctum::actingAs($joiner);
        $this->postJson('/api/matchmaking', $this->seek([]))
            ->assertOk()->assertJson(['matched' => true, 'slot' => 'p2']);
    }

    public function test_expand_range_updates_waiting_room_without_cancel(): void
    {
        $host = $this->makeUser('host', 1400);

        Sanctum::actingAs($host);
        $this->postJson('/api/matchmaking', $this->seek([
            'min_rating' => 1390, 'max_rating' => 1410,
        ]))->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // "Aralığı genişlet": aynı stake ile yeniden poll, geniş aralık -> oda GÜNCELLENİR (yeni oda değil).
        $this->postJson('/api/matchmaking', $this->seek([
            'min_rating' => 1200, 'max_rating' => 1600,
        ]))->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        $this->assertDatabaseCount('rooms', 1);
        $this->assertDatabaseHas('rooms', [
            'p1_user_id' => $host->id, 'min_opp_rating' => 1200, 'max_opp_rating' => 1600,
        ]);
    }
}
