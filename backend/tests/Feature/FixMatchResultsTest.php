<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Geriye-donuk duzeltme: eskiden YANLIS (kazandi diye) yazilmis online mac kaydini
// odanin otoriter sonucuna gore kayba cevirir + kullanicinin rating/win-loss'unu duzeltir.
class FixMatchResultsTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick, int $rating): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->rating = $rating;
        $u->save();

        return $u;
    }

    public function test_backfill_corrects_wrong_win_to_loss(): void
    {
        // p1=beyaz (kaybeden), p2=siyah (kazanan). Skor black=3/white=0, target=3.
        $white = $this->makeUser('wbf', 1516); // yanlis galibiyet sonrasi sismis rating
        $black = $this->makeUser('bbf', 1500);
        Room::create([
            'code' => 'FIXR', 'p1_token' => 't1', 'p1_user_id' => $white->id, 'p1_name' => 'wbf',
            'p2_token' => 't2', 'p2_user_id' => $black->id, 'p2_name' => 'bbf',
            'status' => 'finished', 'target' => 3, 'version' => 1, 'settled' => false,
            'state' => ['match' => ['target' => 3, 'score' => ['white' => 0, 'black' => 3]]],
        ]);
        // YANLIS kayit: beyaz "kazandim" (won=true), +16 rating almis.
        $white->wins = 1;
        $white->save();
        $mr = MatchResult::create([
            'user_id' => $white->id, 'won' => true, 'opponent_rating' => 1500,
            'room_code' => 'FIXR', 'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
        ]);

        $this->artisan('matches:fix-results --apply')->assertExitCode(0);

        $mr->refresh();
        $this->assertFalse((bool) $mr->won, 'won=false olmali');
        $this->assertSame(1484, (int) $mr->rating_after, 'dogru Elo: 1500-16=1484');
        $this->assertSame(-16, (int) $mr->delta);
        $this->assertSame(0, (int) $mr->score_self); // skor otoriter degerle duzeltildi
        $this->assertSame(3, (int) $mr->score_opp);

        $white->refresh();
        $this->assertSame(1484, (int) $white->rating, 'net -32: 1516 -> 1484');
        $this->assertSame(0, (int) $white->wins);
        $this->assertSame(1, (int) $white->losses);
    }

    public function test_dry_run_changes_nothing(): void
    {
        $white = $this->makeUser('wd', 1516);
        $black = $this->makeUser('bd', 1500);
        Room::create([
            'code' => 'DRYR', 'p1_token' => 't1', 'p1_user_id' => $white->id, 'p1_name' => 'wd',
            'p2_token' => 't2', 'p2_user_id' => $black->id, 'p2_name' => 'bd',
            'status' => 'finished', 'target' => 3, 'version' => 1, 'settled' => false,
            'state' => ['match' => ['target' => 3, 'score' => ['white' => 0, 'black' => 3]]],
        ]);
        $mr = MatchResult::create([
            'user_id' => $white->id, 'won' => true, 'opponent_rating' => 1500,
            'room_code' => 'DRYR', 'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
        ]);

        $this->artisan('matches:fix-results')->assertExitCode(0); // --apply YOK

        $mr->refresh();
        $this->assertTrue((bool) $mr->won, 'dry-run yazmamali');
        $this->assertSame(1516, (int) $white->fresh()->rating);
    }
}
