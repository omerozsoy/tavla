<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// "İki oyunda birden" kalkanı: havuzda beklerken / bekleyen davetle başka bir maça bağlanan
// oyuncu ikinci bir oyuna düşmemeli. (bkz RoomController::clearOtherPending + matchmaking guard
// + PresenceController::respond busy guard.)
class DoubleGameGuardTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n): User
    {
        $u = User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n, 'email' => $n.'@e.com', 'password' => bcrypt('secret123'),
        ]);
        $u->coins = 1000;
        $u->rating = 1500;
        $u->email_verified_at = now(); // oyun uclari e-posta dogrulama ister (EnsureEmailVerified; fillable DEGIL)
        $u->save();

        return $u;
    }

    private function waitingRoom(User $p1, string $code): Room
    {
        return Room::create([
            'code' => $code, 'p1_token' => 'host', 'p1_user_id' => $p1->id, 'p1_name' => $p1->nickname,
            'status' => 'waiting', 'stake' => 0, 'bet_pct' => 0, 'target' => 1, 'version' => 0,
        ]);
    }

    private function poolRoom(User $p1, string $code): Room
    {
        return Room::create([
            'code' => $code, 'p1_token' => 'pool', 'p1_user_id' => $p1->id, 'p1_name' => $p1->nickname,
            'status' => 'mm_waiting', 'stake' => 0, 'bet_pct' => 0, 'target' => 1, 'version' => 0,
        ]);
    }

    private function playingRoom(User $p1, string $code): Room
    {
        return Room::create([
            'code' => $code, 'p1_token' => 'ptok', 'p1_user_id' => $p1->id, 'p1_name' => $p1->nickname,
            'p2_token' => 'p2tok', 'p2_user_id' => null, 'p2_name' => 'X',
            'status' => 'playing', 'stake' => 0, 'bet_pct' => 0, 'target' => 1, 'version' => 1,
        ]);
    }

    // Havuzda beklerken bir davet odasına girince eski eşleşme havuzu odası SİLİNİR
    // (yoksa havuz sonradan eşleşip ikinci oyun açardı — bildirilen hata).
    public function test_entering_room_clears_own_matchmaking_pool(): void
    {
        $me = $this->user('seeker');
        $this->poolRoom($me, 'POOL1');      // ben havuzda bekliyorum
        $host = $this->user('inviter');
        $this->waitingRoom($host, 'INV1');  // birinin davet/arkadaş odası

        Sanctum::actingAs($me);
        $this->postJson('/api/rooms/INV1/enter', ['token' => 'newtok', 'name' => 'seeker'])
            ->assertOk()
            ->assertJsonPath('slot', 'p2');

        // Havuz odam artık yok -> ikinci eşleşmeye düşemem.
        $this->assertNull(Room::where('code', 'POOL1')->first());
    }

    // Zaten oynarken eşleşme araması REDDEDİLİR (ücretsiz maç da; eskiden yalnız bahisli korunuyordu).
    public function test_matchmaking_rejected_while_playing(): void
    {
        $me = $this->user('busyseek');
        $this->playingRoom($me, 'BUSY1');

        Sanctum::actingAs($me);
        $this->postJson('/api/matchmaking', ['token' => 'tok', 'name' => 'busyseek', 'bet_pct' => 10])
            ->assertStatus(409);
    }

    // Bitmiş-ama-settle-olmamış bahisli (ranked) maç varken yeni bahisli eşleşme REDDEDİLİR (B fix):
    // aynı coin'i iki maça stake'leyip underwater settlement-deadlock oluşturan eşzamanlılık kapanır
    // (yasar1729 vakası: ilk maç settle gecikirken ikinci %100 bahis açılmıştı).
    public function test_matchmaking_bet_rejected_while_prior_bet_unsettled(): void
    {
        $me = $this->user('unsettledseek');
        $opp = $this->user('unsettledopp');
        Room::create([
            'code' => 'UNS1', 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $me->id, 'p2_user_id' => $opp->id, 'p1_name' => 'A', 'p2_name' => 'B',
            'status' => 'finished', 'mode' => 'ranked', 'stake' => 0, 'bet_pct' => 10,
            'settled' => false, 'target' => 1, 'version' => 1,
        ]);

        Sanctum::actingAs($me);
        $this->postJson('/api/matchmaking', ['token' => 'tok', 'name' => 'unsettledseek', 'bet_pct' => 10])
            ->assertStatus(422);
    }

    // FRIENDLY (arkadaşlık) bitmiş-settle-olmamış oda bahisli eşleşmeyi ENGELLEMEZ: coin taşımaz,
    // settleRoom atladığı için kalıcı settled=false kalır -> kullanıcıyı sonsuza dek bloklamamalı.
    public function test_friendly_unsettled_room_does_not_block_bet_matchmaking(): void
    {
        $me = $this->user('friendlyseek');
        $opp = $this->user('friendlyopp');
        Room::create([
            'code' => 'FRN1', 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $me->id, 'p2_user_id' => $opp->id, 'p1_name' => 'A', 'p2_name' => 'B',
            'status' => 'finished', 'mode' => 'friendly', 'stake' => 0, 'bet_pct' => 20,
            'settled' => false, 'target' => 1, 'version' => 1,
        ]);

        Sanctum::actingAs($me);
        $this->postJson('/api/matchmaking', ['token' => 'tok', 'name' => 'friendlyseek', 'bet_pct' => 10])
            ->assertOk();
    }

    // ESKİ bitmiş-settle-olmamış bahisli oda (kazananı belli olmayan terk edilmiş mezar) yeni bahisli
    // eşleşmeyi ENGELLEMEZ: settle akışı taze (dk); 15dk'dan eski finished oda hiç settle olmayacak
    // (server_winner NULL) -> settled=0 kalıcı, zamansız sayarsak katılımcıyı sonsuza bloklardı
    // (124 kullanıcı vakası). Settle penceresi (dk) güvende, mezar bloklamıyor.
    public function test_stale_finished_unsettled_room_does_not_block(): void
    {
        $me = $this->user('staleseek');
        $opp = $this->user('staleopp');
        $r = Room::create([
            'code' => 'STL1', 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $me->id, 'p2_user_id' => $opp->id, 'p1_name' => 'A', 'p2_name' => 'B',
            'status' => 'finished', 'mode' => 'ranked', 'stake' => 0, 'bet_pct' => 10,
            'settled' => false, 'target' => 1, 'version' => 1,
        ]);
        // updated_at'i 15dk sınırının gerisine zorla (create timestamp'i tazeler -> query ile ez).
        Room::where('id', $r->id)->update(['updated_at' => now()->subMinutes(30)]);

        Sanctum::actingAs($me);
        $this->postJson('/api/matchmaking', ['token' => 'tok', 'name' => 'staleseek', 'bet_pct' => 10])
            ->assertOk();
    }

    // Zaten oynarken gelen daveti kabul REDDEDİLİR; davet 'pending' kalır (maç bitince kabul edilebilir).
    public function test_accept_invite_rejected_while_playing(): void
    {
        $me = $this->user('busyinv');
        $this->playingRoom($me, 'BUSY2');
        $host = $this->user('inviter2');
        $this->waitingRoom($host, 'INV2');
        $id = DB::table('game_invites')->insertGetId([
            'from_user_id' => $host->id, 'to_user_id' => $me->id, 'room_code' => 'INV2',
            'status' => 'pending', 'target' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);

        Sanctum::actingAs($me);
        $this->postJson("/api/invites/{$id}/respond", ['accept' => true])
            ->assertStatus(409);

        $this->assertSame('pending', DB::table('game_invites')->where('id', $id)->value('status'));
    }

    // HARD GARANTİ primitifi: atomik koltuk UNIQUE'tir (ikinci maç reddedilir) + self-healing
    // (ilk maç bitince ikinciye koltuk açılır -> sonsuza dek kilitli kalmaz).
    public function test_match_seat_is_unique_and_self_heals(): void
    {
        $me = $this->user('seatuser');
        $a = $this->playingRoom($me, 'SEATA');
        $b = $this->playingRoom($me, 'SEATB');

        $this->assertTrue(Room::claimMatchSeat($me->id, $a->id));   // ilk koltuk alınır
        $this->assertTrue(Room::claimMatchSeat($me->id, $a->id));   // idempotent (aynı oda)
        $this->assertFalse(Room::claimMatchSeat($me->id, $b->id));  // ikinci maç REDDEDİLİR

        $a->status = 'finished';                                    // ilk maç biter
        $a->save();
        $this->assertTrue(Room::claimMatchSeat($me->id, $b->id));   // self-heal -> ikinciye açılır
    }
}
