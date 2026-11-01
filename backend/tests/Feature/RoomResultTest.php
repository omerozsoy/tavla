<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// GET /me/room-result/{code}: raporu veren/vermeyen fark etmeksizin, caginin bu odadaki OTORITER
// sonucunu (rating + match_result_id) SUNUCUDAN okur. Boylece sonuc ekrani istemci raporuna bagimli
// degil; veri room_code+user_id ile sunucuda hazir.
class RoomResultTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'first_name' => 'R', 'last_name' => 'T', 'country' => '',
            'nickname' => 'rr'.uniqid(), 'email' => uniqid().'@x.com',
            'password' => bcrypt('secret123'), 'rating' => 1500,
        ]);
    }

    public function test_pending_when_no_row_yet(): void
    {
        $u = $this->user();
        Sanctum::actingAs($u);
        $this->getJson('/api/me/room-result/ABCDE')
            ->assertOk()
            ->assertJson(['pending' => true]);
    }

    public function test_returns_authoritative_result_for_caller(): void
    {
        $u = $this->user();
        MatchResult::create([
            'user_id' => $u->id, 'room_code' => 'XY9QR', 'won' => true, 'rated' => true,
            'rating_before' => 1478, 'rating_after' => 1494, 'delta' => 16,
            'opponent_rating' => 1480, 'opponent_name' => 'opp',
            'score_self' => 3, 'score_opp' => 1, 'match_length' => 3, 'match_type' => 'match',
        ]);

        Sanctum::actingAs($u);
        $this->getJson('/api/me/room-result/XY9QR')
            ->assertOk()
            ->assertJson([
                'pending' => false,
                'won' => true,
                'rated' => true,
                'rating_before' => 1478,
                'rating_after' => 1494,
                'delta' => 16,
                'score_self' => 3,
                'score_opp' => 1,
            ])
            ->assertJsonStructure(['match_result_id']);
    }

    public function test_unrated_row_returns_rating_reason(): void
    {
        $u = $this->user();
        MatchResult::create([
            'user_id' => $u->id, 'room_code' => 'FR7ND', 'won' => false, 'rated' => false,
            'rating_reason' => 'friendly', 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'opponent_rating' => 1500, 'opponent_name' => 'opp', 'match_length' => 5, 'match_type' => 'match',
        ]);

        Sanctum::actingAs($u);
        $this->getJson('/api/me/room-result/FR7ND')
            ->assertOk()
            ->assertJson(['pending' => false, 'rated' => false, 'rating_reason' => 'friendly']);
    }

    public function test_only_callers_own_row(): void
    {
        $me = $this->user();
        $other = $this->user();
        MatchResult::create([
            'user_id' => $other->id, 'room_code' => 'ZZ8KK', 'won' => true, 'rated' => true,
            'rating_before' => 1500, 'rating_after' => 1510, 'delta' => 10, 'match_length' => 1,
            'opponent_rating' => 1500, 'opponent_name' => 'opp',
        ]);

        Sanctum::actingAs($me); // kendi satiri yok -> pending (baskasininkini GORMEZ)
        $this->getJson('/api/me/room-result/ZZ8KK')
            ->assertOk()
            ->assertJson(['pending' => true]);
    }
}
