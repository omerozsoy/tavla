<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * /api/me maç/galibiyet/mağlubiyet = GERCEK maclar (real scope), publicProfile ile AYNI kaynak.
 * users.games_played/wins/losses sayaclari yalniz PUANLI maci sayar; arkadaslik/casual maci satir
 * yazar ama sayaci artirmaz -> kendi profil (sayac) ile public kart (real) celisiyordu. Bu test
 * sayac saptigidan bagimsiz /api/me'nin real() sayimini dondurdugunu kilitler.
 */
class MeRealMatchCountTest extends TestCase
{
    use RefreshDatabase;

    public function test_me_reports_real_match_count_not_stale_counter(): void
    {
        $u = User::create([
            'first_name' => 'Ali', 'last_name' => 'T', 'country' => '',
            'nickname' => 'ali', 'email' => 'ali@example.com',
            'password' => bcrypt('secret123'), 'email_verified_at' => now(),
        ]);
        // Sayac kasten DUSUK (yalniz puanli sayar); gercekte 3 real mac var (2 galibiyet + 1 maglubiyet).
        $u->forceFill(['games_played' => 1, 'wins' => 1, 'losses' => 0])->save();

        $base = ['user_id' => $u->id, 'opponent_rating' => 1500, 'rating_before' => 1500,
            'rating_after' => 1500, 'delta' => 0, 'match_length' => 3, 'match_type' => 'match'];
        MatchResult::create(array_merge($base, ['won' => true, 'room_code' => 'R1']));
        MatchResult::create(array_merge($base, ['won' => true, 'room_code' => 'R2']));
        MatchResult::create(array_merge($base, ['won' => false, 'room_code' => 'R3']));
        // AI maci real() HARIC -> sayima girmemeli.
        MatchResult::create(array_merge($base, ['won' => true, 'match_type' => 'ai', 'room_code' => 'R4']));

        Sanctum::actingAs($u);
        $user = $this->getJson('/api/me')->assertOk()->json('user');

        $this->assertSame(3, $user['games_played']); // AI haric real mac
        $this->assertSame(2, $user['wins']);
        $this->assertSame(1, $user['losses']);

        // DB kolonlari DEGISMEDI (yanit override, kalici yazma yok).
        $this->assertSame(1, (int) $u->fresh()->games_played);
    }
}
