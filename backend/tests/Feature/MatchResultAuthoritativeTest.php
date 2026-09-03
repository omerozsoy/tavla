<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// SUNUCU-OTORITER galibiyet/maglubiyet: online macta (room_code) kazanan/kaybeden
// istemcinin 'won' beyanindan DEGIL, odanin paylasilan mac skorundan belirlenir.
// Boylece "kazandim" diye yalan/bayat beyan (perspektif hatasi) kaydi bozamaz.
class MatchResultAuthoritativeTest extends TestCase
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
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    // p1=beyaz, p2=siyah. Skor black=3/white=0, target=3 -> SIYAH (p2) kazandi.
    private function makeFinishedRoom(User $p1, User $p2): Room
    {
        return Room::create([
            'code' => 'AUTHR',
            'p1_token' => 'tok1',
            'p1_user_id' => $p1->id,
            'p1_name' => $p1->nickname,
            'p2_token' => 'tok2',
            'p2_user_id' => $p2->id,
            'p2_name' => $p2->nickname,
            'status' => 'finished',
            'target' => 3,
            'version' => 1,
            'settled' => false,
            'state' => [
                'match' => ['target' => 3, 'score' => ['white' => 0, 'black' => 3]],
                'gameEnd' => ['winner' => 'black'],
            ],
        ]);
    }

    public function test_false_win_claim_recorded_as_loss(): void
    {
        $white = $this->makeUser('whitey'); // p1
        $black = $this->makeUser('blacky'); // p2 (gercek kazanan)
        $this->makeFinishedRoom($white, $black);

        // Beyaz (KAYBEDEN) "kazandim" diye yalan raporlar.
        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => true, // yalan
            'opponent_rating' => 1500,
            'ranked' => true,
            'room_code' => 'AUTHR',
        ])->assertOk();

        $mr = MatchResult::where('user_id', $white->id)->latest('id')->first();
        $this->assertNotNull($mr);
        $this->assertFalse((bool) $mr->won, 'Sunucu skoru: beyaz kaybetti -> won=false olmali');
        $this->assertLessThan(1500, $white->fresh()->rating, 'Kaybeden rating dusmeli');
        $this->assertSame(1, (int) $white->fresh()->losses);
        $this->assertSame(0, (int) $white->fresh()->wins);
    }

    public function test_false_loss_claim_recorded_as_win(): void
    {
        $white = $this->makeUser('whitey2'); // p1
        $black = $this->makeUser('blacky2'); // p2 (gercek kazanan)
        $this->makeFinishedRoom($white, $black);

        // Siyah (KAZANAN) yanlislikla "kaybettim" raporlar (perspektif hatasi).
        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => false, // yanlis
            'opponent_rating' => 1500,
            'ranked' => true,
            'room_code' => 'AUTHR',
        ])->assertOk();

        $mr = MatchResult::where('user_id', $black->id)->latest('id')->first();
        $this->assertNotNull($mr);
        $this->assertTrue((bool) $mr->won, 'Sunucu skoru: siyah kazandi -> won=true olmali');
        $this->assertGreaterThan(1500, $black->fresh()->rating, 'Kazanan rating artmali');
        $this->assertSame(1, (int) $black->fresh()->wins);
    }

    public function test_no_room_falls_back_to_client_claim(): void
    {
        // Oda yok (pvb / temizlenmis): istemci beyanina duser (geriye uyum).
        $u = $this->makeUser('solo');
        Sanctum::actingAs($u);
        $this->postJson('/api/rating/report', [
            'won' => true,
            'opponent_rating' => 1500,
            'ranked' => true,
        ])->assertOk();

        $mr = MatchResult::where('user_id', $u->id)->latest('id')->first();
        $this->assertTrue((bool) $mr->won);
        $this->assertGreaterThan(1500, $u->fresh()->rating);
    }
}
