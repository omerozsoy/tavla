<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Sahte (oynanmamış) kayıp onarımı: hedefli silme + TAM sayaç/rating geri-alımı + oda NO_CONTEST.
class HealFalseLossesTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        $u = User::create([
            'first_name' => 'C', 'last_name' => 'T', 'country' => '',
            'nickname' => 'citta', 'email' => 'citta@e.com', 'password' => bcrypt('secret123'),
        ]);
        $u->rating = 1485;      // sahte kayıptan SONRAKİ (düşmüş) rating
        $u->losses = 3;
        $u->games_played = 10;
        $u->save();

        return $u;
    }

    private function falseLossRow(int $userId, string $room, int $delta): int
    {
        return DB::table('match_results')->insertGetId([
            'user_id' => $userId, 'won' => false, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1485, 'delta' => $delta,
            'room_code' => $room, 'log' => null,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_apply_reverses_counters_neutralizes_room_and_deletes_row(): void
    {
        $u = $this->user();
        Room::create([
            'code' => 'LLZ4F', 'p1_token' => 'a', 'p1_user_id' => $u->id, 'p1_name' => 'citta',
            'p2_token' => 'b', 'p2_user_id' => 999, 'p2_name' => 'X',
            'status' => 'finished', 'p1_result' => 'loss', 'p2_result' => 'win',
            'end_reason' => 'ABANDON', 'stake' => 0, 'version' => 1,
        ]);
        $rowId = $this->falseLossRow($u->id, 'LLZ4F', -15);

        $this->artisan('tavla:heal-false-losses', ['--user' => $u->id, '--room' => 'LLZ4F', '--apply' => true])
            ->assertExitCode(0);

        // Satır silindi
        $this->assertDatabaseMissing('match_results', ['id' => $rowId]);
        // Sayaç + rating tam tersine alındı (rating 1485 -> 1485 - (-15) = 1500)
        $u->refresh();
        $this->assertSame(2, $u->losses);
        $this->assertSame(9, $u->games_played);
        $this->assertSame(1500, $u->rating);
        // Oda nötrlendi -> MatchBackstop yeniden üretmez
        $room = Room::where('code', 'LLZ4F')->first();
        $this->assertNull($room->p1_result);
        $this->assertNull($room->p2_result);
        $this->assertSame('NO_CONTEST', $room->end_reason);
    }

    public function test_dry_without_room_deletes_nothing(): void
    {
        $u = $this->user();
        $rowId = $this->falseLossRow($u->id, 'LLZ4F', -15);

        // --room YOK -> yalnız rapor, hiçbir şey silinmez
        $this->artisan('tavla:heal-false-losses', ['--user' => $u->id])->assertExitCode(0);

        $this->assertDatabaseHas('match_results', ['id' => $rowId]);
        $u->refresh();
        $this->assertSame(3, $u->losses); // dokunulmadı
    }

    public function test_dry_with_room_but_no_apply_deletes_nothing(): void
    {
        $u = $this->user();
        $rowId = $this->falseLossRow($u->id, 'LLZ4F', -15);

        $this->artisan('tavla:heal-false-losses', ['--user' => $u->id, '--room' => 'LLZ4F'])
            ->assertExitCode(0);

        $this->assertDatabaseHas('match_results', ['id' => $rowId]);
        $u->refresh();
        $this->assertSame(1485, $u->rating); // dokunulmadı
    }
}
