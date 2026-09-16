<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Sunucu-otoriter saat + AFK'nin HTTP katmani: eslesme tempo sarti, clock init,
// ve poll (show) sirasinda timeout/AFK enforce (started_at gecmise enjekte edilir ->
// gercek beklemeye gerek yok).
class RoomClockTest extends TestCase
{
    use RefreshDatabase;

    private function playingRoom(string $code, string $mode, int $target): Room
    {
        return Room::create([
            'code' => $code,
            'p1_token' => 't1',
            'p1_name' => 'P1',
            'p2_token' => 't2',
            'p2_name' => 'P2',
            'status' => 'playing',
            'mode' => 'ranked',
            'time_control' => $mode,
            'target' => $target,
            'version' => 1,
        ]);
    }

    private function state(int $target, string $turn = 'white'): array
    {
        return [
            'match' => ['target' => $target, 'cube' => ['value' => 1, 'owner' => null], 'score' => ['white' => 0, 'black' => 0]],
            'turnStart' => ['turn' => $turn],
            'played' => [],
            'starter' => 'white',
            'turnsPlayed' => 0,
        ];
    }

    // ---- Eslesme: yalniz AYNI tempo ----
    public function test_matchmaking_pairs_only_same_time_control(): void
    {
        $this->postJson('/api/matchmaking', ['token' => 'A', 'name' => 'A', 'targets' => [5], 'time_control' => 'normal'])
            ->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // Farkli tempo -> A ile ESLESMEZ, kendi havuzuna girer
        $this->postJson('/api/matchmaking', ['token' => 'B', 'name' => 'B', 'targets' => [5], 'time_control' => 'speed'])
            ->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // Ayni tempo -> A ile eslesir
        $this->postJson('/api/matchmaking', ['token' => 'C', 'name' => 'C', 'targets' => [5], 'time_control' => 'normal'])
            ->assertOk()->assertJson(['matched' => true, 'slot' => 'p2']);
    }

    // ---- update saati kurar + clock doner; show clock doner ----
    public function test_update_initializes_and_returns_clock(): void
    {
        $this->playingRoom('CLK1', 'normal', 5); // normal 5 -> banka 300

        $res = $this->putJson('/api/rooms/CLK1', ['token' => 't1', 'state' => $this->state(5)])->assertOk();
        $clock = $res->json('clock');
        $this->assertSame('white', $clock['active']);
        $this->assertGreaterThanOrEqual(299, $clock['white']);
        $this->assertLessThanOrEqual(300, $clock['white']);
        $this->assertEqualsWithDelta(300, $clock['black'], 1.0);

        // show da clock icermeli
        $showClock = $this->getJson('/api/rooms/CLK1')->assertOk()->json('room.clock');
        $this->assertSame('white', $showClock['active']);
    }

    // ---- show TIMEOUT'u enforce eder (speed 1: ana sure AFK'dan once biter) ----
    public function test_show_enforces_timeout(): void
    {
        $room = $this->playingRoom('CLK2', 'speed', 1); // banka 24, delay 8 -> timeout 32sn
        $this->putJson('/api/rooms/CLK2', ['token' => 't1', 'state' => $this->state(1)])->assertOk();

        // started_at'i gecmise it: 40sn once (timeout 32 gecti, afk 60 henuz)
        $room->refresh();
        $clock = $room->clock;
        $clock['started_at'] = microtime(true) - 40;
        $room->clock = $clock;
        $room->save();

        $this->getJson('/api/rooms/CLK2')->assertOk();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('TIMEOUT', $room->end_reason);
        $this->assertSame('lost', $room->p1_result); // beyaz(p1) suresi bitti
        $this->assertSame('won', $room->p2_result);
        $this->assertNotEmpty($room->state['gameEnd']);
        $this->assertSame('black', $room->state['gameEnd']['winner']);
    }

    // ---- show AFK_TIMEOUT'u enforce eder (casual 5: ana sure uzun, once AFK) ----
    // AFK yalniz ILK gercek hamleden sonra sayilir -> once bir gercek hamle gonderilir.
    public function test_show_enforces_afk_timeout(): void
    {
        $room = $this->playingRoom('CLK3', 'casual', 5); // banka 900 -> timeout cok ileride
        $this->putJson('/api/rooms/CLK3', ['token' => 't1', 'state' => $this->state(5)])->assertOk();
        // Ilk gercek hamle (imza degisir) -> moved=true, AFK artik gecerli
        $moved = $this->state(5);
        $moved['turnsPlayed'] = 1;
        $moved['played'] = [['x' => 1]];
        $this->putJson('/api/rooms/CLK3', ['token' => 't1', 'state' => $moved])->assertOk();

        $room->refresh();
        $clock = $room->clock;
        $clock['started_at'] = microtime(true) - 65; // afk 60 gecti
        $room->clock = $clock;
        $room->save();

        $this->getJson('/api/rooms/CLK3')->assertOk();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('AFK_TIMEOUT', $room->end_reason);
        $this->assertSame('won', $room->p2_result);
    }

    // ---- Rakip (sira sahibi degil) update'i AFK'yi sifirlayamaz (forge korumasi) ----
    public function test_non_owner_update_does_not_reset_afk(): void
    {
        $room = $this->playingRoom('CLK4', 'casual', 5);
        $this->putJson('/api/rooms/CLK4', ['token' => 't1', 'state' => $this->state(5)])->assertOk();

        // started_at'i 40sn geriye it (afk sayiyor)
        $room->refresh();
        $clock = $room->clock;
        $startWas = microtime(true) - 40;
        $clock['started_at'] = $startWas;
        $room->clock = $clock;
        $room->save();

        // p2 (sira sahibi DEGIL) imza degistiren update gonderir -> started_at DEGISMEMELI
        $forge = $this->state(5);
        $forge['turnsPlayed'] = 9;
        $forge['played'] = [['x' => 1], ['x' => 1]];
        $this->putJson('/api/rooms/CLK4', ['token' => 't2', 'state' => $forge])->assertOk();

        $room->refresh();
        $this->assertEqualsWithDelta($startWas, $room->clock['started_at'], 0.5);
        $this->assertSame('p1', $room->clock['turn_slot']);
    }

    // ---- leave: TERK EDEN KAYBEDER (anlik forfeit) ----
    public function test_leave_forfeits_leaver(): void
    {
        $room = $this->playingRoom('CLKL', 'normal', 1);
        $this->putJson('/api/rooms/CLKL', ['token' => 't1', 'state' => $this->state(1)])->assertOk();

        $this->postJson('/api/rooms/CLKL/leave', ['token' => 't1'])->assertOk(); // p1 terk eder

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('ABANDON', $room->end_reason);
        $this->assertSame('lost', $room->p1_result); // terk eden
        $this->assertSame('won', $room->p2_result);  // rakip kazanir
        $this->assertSame('black', $room->state['gameEnd']['winner']);
    }

    // ---- KORUMA: maç ZATEN sonuçlandıysa geç terk KAZANANI ters çevirmesin (DrBakır bug'ı) ----
    public function test_leave_does_not_overturn_decided_match(): void
    {
        $winner = \App\Models\User::create([
            'first_name' => 'Win', 'last_name' => 'T', 'country' => '', 'nickname' => 'Winner',
            'email' => 'win@t.co', 'password' => bcrypt('secret123'),
        ]);
        $loser = \App\Models\User::create([
            'first_name' => 'Los', 'last_name' => 'T', 'country' => '', 'nickname' => 'Loser',
            'email' => 'los@t.co', 'password' => bcrypt('secret123'),
        ]);
        $winner->forceFill(['rating' => 1500])->save();
        $loser->forceFill(['rating' => 1500])->save();
        $room = $this->playingRoom('CLKD', 'normal', 1);
        $room->p1_user_id = $winner->id;
        $room->p2_user_id = $loser->id;
        $room->p1_rating = 1500;
        $room->p2_rating = 1500;
        $room->save();

        // Tek oyun ZATEN kazanıldı: beyaz (p1 = winner) hedefe ulaştı + gameEnd.winner=white.
        $state = $this->state(1);
        $state['match']['score'] = ['white' => 1, 'black' => 0];
        $state['gameEnd'] = ['winner' => 'white'];
        $this->putJson('/api/rooms/CLKD', ['token' => 't1', 'state' => $state])->assertOk();

        // KAZANAN (p1/beyaz) sekmeyi kapatır (leave). Sonuç TERS ÇEVRİLMEMELİ.
        $this->postJson('/api/rooms/CLKD/leave', ['token' => 't1'])->assertOk();

        $room->refresh();
        // Kazanan "terk edip kaybetti" olarak yazılmadı: p1_result 'lost' + ABANDON OLMAMALI.
        $this->assertNotSame('lost', $room->p1_result);
        $this->assertNotSame('ABANDON', $room->end_reason);
        // ForfeitLoss KAZANANI (p1) kaybeden olarak yazmadı -> onun için terk-kayıp satırı yok.
        $this->assertDatabaseMissing('match_results', ['user_id' => $winner->id, 'room_code' => 'CLKD']);
    }

    // ---- show (poll): rakip poll'u kesince (terk) o kaybeder; SIRA SAHIBI KORUNUR ----
    public function test_show_forfeits_absent_opponent_protecting_turn_owner(): void
    {
        $room = $this->playingRoom('CLKP', 'casual', 5); // uzun banka; AFK 60
        $this->putJson('/api/rooms/CLKP', ['token' => 't1', 'state' => $this->state(5)])->assertOk();

        $room->refresh();
        $clock = $room->clock;
        $now = microtime(true);
        $clock['started_at'] = $now - 10;  // AFK dolmadi (10 < 60)
        $clock['p1_seen'] = $now - 1;      // sira sahibi present
        $clock['p2_seen'] = $now - 70;     // rakip terk (70 > 60+3)
        $room->clock = $clock;
        $room->save();

        // Sira sahibi (t1) poll eder -> rakip terk tespit edilir
        $this->getJson('/api/rooms/CLKP?token=t1')->assertOk();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('ABANDON', $room->end_reason);
        $this->assertSame('won', $room->p1_result);  // sira sahibi korundu + kazandi
        $this->assertSame('lost', $room->p2_result); // terk eden kaybetti
    }

    // ---- IKISI DE terk (saat durmus / acilis 0-0): NO-CONTEST ile finalize (hayalet mac fix) ----
    // Eskiden presence yalniz "tam biri terk" iken karar veriyordu; ikisi de gidince mac HIC
    // bitmiyor, oda 'playing'de asili kaliyordu -> "Devam Eden Maç" hayaleti + izleyici DONMASI.
    public function test_show_finalizes_when_both_players_abandoned_no_contest(): void
    {
        $room = $this->playingRoom('CLKB', 'casual', 5);
        $this->putJson('/api/rooms/CLKB', ['token' => 't1', 'state' => $this->state(5)])->assertOk();

        $room->refresh();
        $clock = $room->clock;
        $now = microtime(true);
        $clock['started_at'] = $now - 5;
        $clock['p1_seen'] = $now - 70; // ikisi de terk (70 > 60+3)
        $clock['p2_seen'] = $now - 80;
        $room->clock = $clock;
        $verBefore = (int) $room->version;
        $room->save();

        // Izleyici (token yok) poll eder -> ikisi-de-terk no-contest ile finalize edilir
        $this->getJson('/api/rooms/CLKB')->assertOk();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('ABANDON', $room->end_reason);
        // NO-CONTEST: kimse kazanmaz/kaybetmez -> sonuc kolonlari null (puan/coin islenmez)
        $this->assertNull($room->p1_result);
        $this->assertNull($room->p2_result);
        // Surum ARTMALI -> izleyicinin surum-kapili poll'u 'finished'i yakalayip donmaktan cikar
        $this->assertGreaterThan($verBefore, (int) $room->version);
    }

    // ---- Zamanlanmis supurme: kimsenin poll etmedigi bayat 'playing' oda -> finalize ----
    public function test_reap_stale_finalizes_untouched_playing_room(): void
    {
        $room = $this->playingRoom('CLKR', 'normal', 5);
        $this->putJson('/api/rooms/CLKR', ['token' => 't1', 'state' => $this->state(5)])->assertOk();
        // 5 dk dokunulmamis (bayat: canli olsa updated_at ~1.5sn'de tazelenirdi) yap
        Room::where('code', 'CLKR')->update(['updated_at' => now()->subMinutes(5)]);

        $this->artisan('matches:reap-stale')->assertSuccessful();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('ABANDON', $room->end_reason);
        $this->assertNull($room->p1_result);
        $this->assertNull($room->p2_result);
    }

    // ---- Zamanlanmis supurme: SONUCU BELLI ama finalize edilmemis oda -> gercek kazanani korur ----
    public function test_reap_stale_preserves_decided_winner(): void
    {
        $room = $this->playingRoom('CLKW', 'normal', 1);
        $state = $this->state(1);
        $state['match']['score'] = ['white' => 1, 'black' => 0];
        $state['gameEnd'] = ['winner' => 'white'];
        $this->putJson('/api/rooms/CLKW', ['token' => 't1', 'state' => $state])->assertOk();
        Room::where('code', 'CLKW')->update(['updated_at' => now()->subMinutes(5)]);

        $this->artisan('matches:reap-stale')->assertSuccessful();

        $room->refresh();
        $this->assertSame('finished', $room->status);
        $this->assertSame('won', $room->p1_result);   // beyaz(p1) hedefe ulasti
        $this->assertSame('lost', $room->p2_result);
        $this->assertNotSame('ABANDON', $room->end_reason); // no-contest DEGIL: gercek galibiyet
    }
}
