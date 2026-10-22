<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Maç Analizleri "maç tipi" (uzunluk) filtresi: /me/matches?len=N sunucu tarafında uzunluğa göre
 * süzer (0 = jeton/null); /me/match-lengths oynanan distinct uzunlukları (sekme seçenekleri) döner.
 */
class MyMatchesFilterTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'first_name' => 'Ali', 'last_name' => 'T', 'country' => '',
            'nickname' => 'ali', 'email' => 'ali@example.com',
            'password' => bcrypt('secret123'), 'email_verified_at' => now(),
        ]);
    }

    private function mr(User $u, ?int $len, string $room): void
    {
        MatchResult::create([
            'user_id' => $u->id, 'won' => true,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'match_length' => $len, 'match_type' => 'match', 'pr' => 5.0, 'room_code' => $room,
        ]);
    }

    public function test_len_filter_and_lengths_endpoint(): void
    {
        $u = $this->user();
        $this->mr($u, 1, 'R1');
        $this->mr($u, 3, 'R2');
        $this->mr($u, 3, 'R3');
        $this->mr($u, 5, 'R4');
        $this->mr($u, 0, 'R5'); // jeton (match_length=0)
        Sanctum::actingAs($u);

        // match-lengths: oynanan distinct uzunluklar (0 jeton dahil), sıralı.
        $lens = $this->getJson('/api/me/match-lengths')->assertOk()->json('lengths');
        $this->assertEqualsCanonicalizing([0, 1, 3, 5], $lens);

        // len=3 -> yalnız 3 puanlık (2 maç).
        $this->assertCount(2, $this->getJson('/api/me/matches?len=3')->assertOk()->json('matches'));
        // len=1 -> 1 maç.
        $this->assertCount(1, $this->getJson('/api/me/matches?len=1')->assertOk()->json('matches'));
        // len=0 -> jeton (match_length 0/null) -> 1 maç.
        $this->assertCount(1, $this->getJson('/api/me/matches?len=0')->assertOk()->json('matches'));
        // filtresiz -> hepsi (5).
        $this->assertCount(5, $this->getJson('/api/me/matches')->assertOk()->json('matches'));
    }
}
