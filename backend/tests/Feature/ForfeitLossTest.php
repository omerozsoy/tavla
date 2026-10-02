<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use App\Services\MatchClock;
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

    private function startClock(Room $room): void
    {
        $clock = MatchClock::init('speed', 1, microtime(true));
        $clock['turn_slot'] = 'p1';
        $clock['running'] = true;
        $clock['moved'] = true;
        $room->state = $this->state();
        $room->clock = $clock;
        $room->save();
    }

    // Forfeit (TIMEOUT) -> kaybedenin (p1/A) rating dusukleri + maglubiyet + satir SUNUCUDA.
    public function test_forfeit_records_loser_rating_and_loss(): void
    {
        $a = $this->user('a'); // sira sahibi (beyaz/p1) -> suresi bitince kaybeder
        $b = $this->user('b');
        $room = $this->rankedRoom('FL1', $a, $b);

        // Saati kur (p1 sirasinda), sonra started_at'i gecmise it (speed1 timeout 32sn).
        $this->startClock($room);
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
        $this->startClock($room);
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
        ])->assertStatus(409);

        $a->refresh();
        $this->assertSame(1, (int) $a->losses);                 // hala 1 (cift degil)
        $this->assertSame($ratingAfterForfeit, (int) $a->rating); // rating degismedi
        $this->assertSame(1, MatchResult::where('room_code', 'FL2')->where('user_id', $a->id)->count());
    }

    // D5CTF REGRESYONU: oda SUNUCU-OTORİTER sonucu bu "kaybeden"in aslında KAZANDIĞINI söylüyorsa
    // ForfeitLoss ASLA kayıp yazmamalı (nadir forfeit yarışında gerçek kazanana da -Elo düşüyordu).
    public function test_does_not_record_loss_for_actual_winner(): void
    {
        $winner = $this->user('w', 1403); // server_match'e göre siyah (p2) KAZANAN
        $loser = $this->user('l', 1400);
        $room = $this->rankedRoom('D5R', $loser, $winner); // p1=loser(beyaz), p2=winner(siyah)
        $room->forceFill([
            'authoritative' => true,
            'server_match' => ['done' => true, 'winner' => 'black', 'score' => ['white' => 2, 'black' => 3]],
        ])->save();

        // Yanlışlıkla gerçek kazananı (p2/siyah) kaybeden olarak yazmaya çalış -> hiçbir şey olmamalı.
        \App\Support\ForfeitLoss::record('D5R', $winner->id, 1400, 3, 'match', 'l', true, $loser->id);

        $winner->refresh();
        $this->assertSame(1403, (int) $winner->rating);        // Elo değişmedi
        $this->assertSame(0, (int) $winner->losses);           // mağlubiyet yazılmadı
        $this->assertNull(MatchResult::where('room_code', 'D5R')->where('user_id', $winner->id)->first());

        // Gerçek kaybeden (p1/beyaz) hâlâ yazılabilir.
        \App\Support\ForfeitLoss::record('D5R', $loser->id, 1403, 3, 'match', 'w', true, $winner->id);
        $loser->refresh();
        $this->assertSame(1, (int) $loser->losses);
        $this->assertFalse((bool) MatchResult::where('room_code', 'D5R')->where('user_id', $loser->id)->first()->won);
    }

    // Oynanan coin bahsi forfeit satırına SABITLENİR ve oda purge edilse de kalır
    // (admin "Oynanan bahis" artık rooms.stake yerine bu snapshot'tan okur).
    public function test_forfeit_snapshots_stake_surviving_room_purge(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $room = $this->rankedRoom('FLS', $a, $b);
        $room->forceFill(['stake' => 500])->save();

        \App\Support\ForfeitLoss::record('FLS', $a->id, 1500, 1, 'coin', 'b', true, $b->id);

        $row = MatchResult::where('room_code', 'FLS')->where('user_id', $a->id)->first();
        $this->assertSame(500, (int) $row->stake);

        $room->delete(); // oda purge edildi -> snapshot yine durur
        $this->assertSame(500, (int) MatchResult::find($row->id)->stake);
    }

    // GÜNCEL kural (kullanıcı direktifi): davet (friendly/kılıç) maçları PUANLIDIR (aynı-rakip 24h
    // limiti altında). Terk edilince KAYBEDEN puan/mağlubiyet KAYBEDER (ilk maç -> limit altı).
    public function test_friendly_forfeit_within_cap_is_rated(): void
    {
        $a = $this->user('a'); // sıra sahibi (beyaz/p1) -> süresi bitince kaybeder
        $b = $this->user('b');
        $room = $this->rankedRoom('FL3', $a, $b);
        $room->mode = 'friendly';
        $room->save();
        $this->startClock($room);
        $room->refresh();
        $clock = $room->clock;
        $clock['started_at'] = microtime(true) - 40;
        $room->clock = $clock;
        $room->save();
        // Tokensiz (izleyici) poll: oda GÖRÜNÜR + forfeit finalize edilir (satır yazılır).
        $this->getJson('/api/rooms/FL3')->assertOk();

        $a->refresh();
        $this->assertLessThan(1500, (int) $a->rating);    // PUANLI: kaybeden rating düştü
        $this->assertSame(1, (int) $a->losses);           // mağlubiyet arttı
        $row = MatchResult::where('room_code', 'FL3')->where('user_id', $a->id)->first();
        $this->assertNotNull($row);
        $this->assertLessThan(0, (int) $row->delta);      // delta<0 (puan kaybı)
        $this->assertTrue((bool) $row->rated);            // rated=true (limit altı)
    }
}
