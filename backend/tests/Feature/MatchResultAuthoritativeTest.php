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

    // Oda KARARSIZ (skor hedefe ulasmamis, p_result yok) ama rakip zaten "kazandim"
    // raporlamis -> bu tarafin "kazandim"i REDDEDILIR (ikisi birden kazanamaz).
    public function test_undecided_room_forces_complement_of_opponent(): void
    {
        $white = $this->makeUser('wu'); // p1
        $black = $this->makeUser('bu'); // p2
        Room::create([
            'code' => 'UNDEC', 'p1_token' => 't1', 'p1_user_id' => $white->id, 'p1_name' => 'wu',
            'p2_token' => 't2', 'p2_user_id' => $black->id, 'p2_name' => 'bu',
            'status' => 'playing', 'target' => 3, 'version' => 1, 'settled' => false,
            // Skor 1-0, hedef 3 -> KARARSIZ; p_result yok, gameEnd yok.
            'state' => ['match' => ['target' => 3, 'score' => ['white' => 1, 'black' => 0]]],
        ]);
        // Rakip (siyah) ONCE "kazandim" raporladi.
        MatchResult::create([
            'user_id' => $black->id, 'won' => true, 'opponent_rating' => 1500,
            'room_code' => 'UNDEC', 'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
        ]);

        // Beyaz da "kazandim" der -> reddedilmeli (tamamlayici: kayip).
        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'UNDEC',
        ])->assertOk();

        $mr = MatchResult::where('user_id', $white->id)->latest('id')->first();
        $this->assertFalse((bool) $mr->won, 'Rakip kazandi dediyse bu taraf kazanamaz');
        $this->assertLessThan(1500, $white->fresh()->rating);
    }

    // Rakip ONCE (yaris aninda oda kararsizken) YANLIS raporladi; oda simdi KESIN.
    // Otoriter raporda rakibin satiri da tamamlayiciya cekilir (self-heal).
    public function test_authoritative_report_heals_opponent_wrong_row(): void
    {
        $white = $this->makeUser('wh'); // p1 (kaybeden)
        $black = $this->makeUser('bh'); // p2 (gercek kazanan)
        Room::create([
            'code' => 'HEAL', 'p1_token' => 't1', 'p1_user_id' => $white->id, 'p1_name' => 'wh',
            'p2_token' => 't2', 'p2_user_id' => $black->id, 'p2_name' => 'bh',
            'status' => 'finished', 'target' => 3, 'version' => 1, 'settled' => false,
            'state' => ['match' => ['target' => 3, 'score' => ['white' => 0, 'black' => 3]]],
        ]);
        // Siyah (gercek KAZANAN) yanlislikla "kaybettim" raporlamis: rating dusmus.
        $black->rating = 1484;
        $black->losses = 1;
        $black->save();
        $blackRow = MatchResult::create([
            'user_id' => $black->id, 'won' => false, 'opponent_rating' => 1500,
            'room_code' => 'HEAL', 'rating_before' => 1500, 'rating_after' => 1484, 'delta' => -16,
        ]);

        // Beyaz (kaybeden) raporlar -> oda KESIN (beyaz kaybetti). Bu otoriter rapor
        // sirasinda siyahin yanlis satiri da duzeltilir (ikisi birden kaybedemez).
        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => false, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'HEAL',
        ])->assertOk();

        $blackRow->refresh();
        $this->assertTrue((bool) $blackRow->won, 'Siyahin satiri galibiyete duzeltilmeli');
        $this->assertSame(1516, (int) $blackRow->rating_after);
        $this->assertSame(1516, (int) $black->fresh()->rating, 'net +32: 1484 -> 1516');
        $this->assertSame(1, (int) $black->fresh()->wins);
        $this->assertSame(0, (int) $black->fresh()->losses);
    }
}
