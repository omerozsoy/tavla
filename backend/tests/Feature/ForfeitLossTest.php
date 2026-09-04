<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// "Terk eden kaybeder" SUNUCU kaydi: forfeit (timeout/afk/presence/leave) ilan edilince
// kaybedenin rating + maglubiyet + match_results satiri istemci raporlamasa da yazilir.
class ForfeitLossTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick, int $rating = 1500): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(['rating' => $rating])->save(); // rating fillable degil
        return $u;
    }

    private function rankedRoom(string $code, User $a, User $b): Room
    {
        return Room::create([
            'code' => $code,
            'p1_token' => 'tA', 'p1_user_id' => $a->id, 'p1_name' => 'A', 'p1_rating' => $a->rating,
            'p2_token' => 'tB', 'p2_user_id' => $b->id, 'p2_name' => 'B', 'p2_rating' => $b->rating,
            'status' => 'playing', 'mode' => 'ranked', 'time_control' => 'speed', 'target' => 1,
            'version' => 1,
        ]);
    }

    private function state(int $target = 1, string $turn = 'white'): array
    {
        return [
            'match' => ['target' => $target, 'cube' => ['value' => 1, 'owner' => null], 'score' => ['white' => 0, 'black' => 0]],
            'turnStart' => ['turn' => $turn], 'played' => [], 'starter' => 'white', 'turnsPlayed' => 0,
        ];
    }

    // Forfeit (TIMEOUT) -> kaybedenin (p1/A) rating dusukleri + maglubiyet + satir SUNUCUDA.
    public function test_forfeit_records_loser_rating_and_loss(): void
    {
        $a = $this->user('a'); // sira sahibi (beyaz/p1) -> suresi bitince kaybeder
        $b = $this->user('b');
        $room = $this->rankedRoom('FL1', $a, $b);

        // Saati kur (p1 sirasinda), sonra started_at'i gecmise it (speed1 timeout 32sn).
        $this->putJson('/api/rooms/FL1', ['token' => 'tA', 'state' => $this->state()])->assertOk();
        $room->refresh();
        $clock = $room->clock;
        $clock['started_at'] = microtime(true) - 40;
        $room->clock = $clock;
        $room->save();

        // Poll -> forfeit ilan edilir + ForfeitLoss kaybedeni (A) yazar.
        $this->getJson('/api/rooms/FL1')->assertOk();

        $a->refresh();
        $this->assertLessThan(1500, $a->rating);          // rating dustu
        $this->assertSame(1, (int) $a->losses);           // maglubiyet +1
        $this->assertSame(1, (int) $a->games_played);     // oynanan +1
        $row = MatchResult::where('room_code', 'FL1')->where('user_id', $a->id)->first();
        $this->assertNotNull($row);
        $this->assertFalse((bool) $row->won);
        // Kazanan (B) sunucuda YAZILMAZ (kendi client'i raporlar) -> satiri yok.
        $this->assertNull(MatchResult::where('room_code', 'FL1')->where('user_id', $b->id)->first());
    }

    // Kaybedenin GEC gelen client raporu CIFT saymaz (idempotent).
    public function test_late_client_report_is_idempotent(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $room = $this->rankedRoom('FL2', $a, $b);
        $this->putJson('/api/rooms/FL2', ['token' => 'tA', 'state' => $this->state()])->assertOk();
        $room->refresh();
        $clock = $room->clock;
        $clock['started_at'] = microtime(true) - 40;
        $room->clock = $clock;
        $room->save();
        $this->getJson('/api/rooms/FL2')->assertOk(); // forfeit -> A yazildi

        $a->refresh();
        $ratingAfterForfeit = (int) $a->rating;

        // A'nin client'i gec gelip kaybi raporlarsa: TEKRAR yazilmamali.
        Sanctum::actingAs($a);
        $this->postJson('/api/rating/report', [
            'won' => false, 'opponent_rating' => 1500, 'match_length' => 1, 'ranked' => true, 'room_code' => 'FL2',
        ])->assertOk();

        $a->refresh();
        $this->assertSame(1, (int) $a->losses);                 // hala 1 (cift degil)
        $this->assertSame($ratingAfterForfeit, (int) $a->rating); // rating degismedi
        $this->assertSame(1, MatchResult::where('room_code', 'FL2')->where('user_id', $a->id)->count());
    }

    // Arkadaslik (friendly) odasi: forfeit'te rating/maglubiyet YAZILMAZ (puansiz).
    public function test_friendly_forfeit_does_not_record_loss(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $room = $this->rankedRoom('FL3', $a, $b);
        $room->mode = 'friendly';
        $room->save();
        $this->putJson('/api/rooms/FL3', ['token' => 'tA', 'state' => $this->state()])->assertOk();
        $room->refresh();
        $clock = $room->clock;
        $clock['started_at'] = microtime(true) - 40;
        $room->clock = $clock;
        $room->save();
        $this->getJson('/api/rooms/FL3')->assertOk();

        $a->refresh();
        $this->assertSame(1500, (int) $a->rating);
        $this->assertSame(0, (int) $a->losses);
        $this->assertNull(MatchResult::where('room_code', 'FL3')->first());
    }
}
