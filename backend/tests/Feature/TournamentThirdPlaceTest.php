<?php

namespace Tests\Feature;

use App\Http\Controllers\TournamentController;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// 3.'LÜK MAÇI: iki yarı final KAYBEDENİ otomatik 3.'lük maçına atılır; maç oynanınca kazanan 3.,
// kaybeden 4. olur. Turnuva final + 3.'lük İKİSİ de bitince kapanır (paralel oynanır).
class TournamentThirdPlaceTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    /** private applyWinnerToBracket'i reflection ile çağır (report() otoriter oda ister). */
    private function apply(Tournament $t, int $ri, int $mi, int $winnerId): void
    {
        $c = new TournamentController();
        $ref = new \ReflectionMethod($c, 'applyWinnerToBracket');
        $ref->setAccessible(true);
        $ref->invoke($c, $t, $ri, $mi, $winnerId, ['p1' => 1, 'p2' => 0]);
    }

    private function standings(Tournament $t): array
    {
        $c = new TournamentController();
        $ref = new \ReflectionMethod($c, 'standingsFromBracket');
        $ref->setAccessible(true);

        return $ref->invoke($c, $t->bracket);
    }

    private function callPrivate(Tournament $t, string $method): mixed
    {
        $c = new TournamentController();
        $ref = new \ReflectionMethod($c, $method);
        $ref->setAccessible(true);

        return $ref->invoke($c, $t);
    }

    public function test_semi_losers_auto_placed_into_third_place_match_and_it_is_startable(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $cc = $this->user('c');
        $d = $this->user('d');
        $p = fn (User $u) => ['id' => $u->id, 'name' => strtoupper($u->nickname), 'rating' => 1500];

        $t = Tournament::create([
            'name' => 'T', 'size' => 4, 'status' => 'running', 'active' => true,
            'players' => [$p($a), $p($b), $p($cc), $p($d)],
            'bracket' => [
                [ // yarı finaller
                    ['key' => 'r0m0', 'p1' => $p($a), 'p2' => $p($b), 'winner' => null],
                    ['key' => 'r0m1', 'p1' => $p($cc), 'p2' => $p($d), 'winner' => null],
                ],
                [ // final
                    ['key' => 'r1m0', 'p1' => null, 'p2' => null, 'winner' => null],
                ],
            ],
        ]);

        // Yarı final 1: A yener B -> B otomatik 3.'lük maçına. Yarı final 2: C yener D -> D 3.'lüğe.
        $this->apply($t, 0, 0, $a->id);
        $this->apply($t, 0, 1, $cc->id);
        $t->refresh();

        // KRİTİK: 3.'lük maçı OTOMATİK oluştu ve iki yarı final KAYBEDENİYLE dolu.
        $tp = $t->bracket[1][1] ?? null;
        $this->assertNotNull($tp, '3.lük maçı otomatik oluşmalı');
        $this->assertTrue((bool) ($tp['third_place'] ?? false));
        $this->assertSame($b->id, $tp['p1']['id']);  // yarı final 1 kaybedeni
        $this->assertSame($d->id, $tp['p2']['id']);  // yarı final 2 kaybedeni
        $this->assertNull($tp['winner']);
        // Final iki yarı final KAZANANIYLA dolu.
        $this->assertSame($a->id, $t->bracket[1][0]['p1']['id']);
        $this->assertSame($cc->id, $t->bracket[1][0]['p2']['id']);
        $this->assertSame('running', $t->status);

        // GATE: FINAL (r1m0) 3.'lük bitmeden AÇILMAZ (önce 3.'lük oynanır).
        Sanctum::actingAs($a);
        $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => 'r1m0'])
            ->assertStatus(422);
        // 3.'lük maçı ise OTOMATİK açılır (oda kodu üretilir -> oyuncu girince başlar).
        Sanctum::actingAs($b);
        $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => 'r1m1'])
            ->assertOk()
            ->assertJsonStructure(['code']);

        // 3.'lük maçı oynanır: B yener D. Final için opens_at (+1dk) yazılır; turnuva hâlâ kapanmaz.
        $this->apply($t, 1, 1, $b->id);
        $t->refresh();
        $this->assertNotEmpty($t->bracket[1][0]['opens_at'] ?? null, '3.lük bitince final opens_at set edilmeli');
        $this->assertSame('running', $t->status, 'final oynanmadan turnuva kapanmamalı');

        // Final oynanır (reflection gate'i atlar): A şampiyon -> turnuva kapanır.
        $this->apply($t, 1, 0, $a->id);
        $t->refresh();
        $this->assertSame($a->id, (int) $t->champion_id);
        $this->assertSame('finished', $t->status);

        // Sıralama: 1=A(şampiyon), 2=C(final kaybedeni), 3=B(3.lük kazananı), 4=D
        $this->assertSame([$a->id, $cc->id, $b->id, $d->id], array_slice($this->standings($t), 0, 4));
    }

    public function test_bye_semifinal_gives_walkover_third_place(): void
    {
        // Bir yarı final bye (tek oyuncu) -> 3.'lük maçı tek oyunculu kalır -> diğer yarı final
        // kaybedeni walkover ile 3. olur (turnuva takılmaz).
        $a = $this->user('a');
        $b = $this->user('b');
        $cc = $this->user('c');
        $p = fn (User $u) => ['id' => $u->id, 'name' => strtoupper($u->nickname), 'rating' => 1500];

        $t = Tournament::create([
            'name' => 'T', 'size' => 4, 'status' => 'running', 'active' => true,
            'players' => [$p($a), $p($b), $p($cc)],
            'bracket' => [
                [
                    ['key' => 'r0m0', 'p1' => $p($a), 'p2' => $p($b), 'winner' => null],
                    ['key' => 'r0m1', 'p1' => $p($cc), 'p2' => null, 'winner' => $cc->id], // bye
                ],
                [['key' => 'r1m0', 'p1' => null, 'p2' => $p($cc), 'winner' => null]],
            ],
        ]);

        // Bye kazananı (C) zaten finalde. Gerçek yarı finali oyna: A yener B -> B tek başına 3.'lükte.
        $this->apply($t, 0, 0, $a->id);
        // Final: A şampiyon. 3.'lük tek oyunculu (B) -> walkover -> B 3.; turnuva kapanır.
        $this->apply($t, 1, 0, $a->id);
        $t->refresh();

        $this->assertSame('finished', $t->status);
        $tp = $t->bracket[1][1] ?? null;
        $this->assertNotNull($tp);
        $this->assertSame($b->id, (int) $tp['winner']); // walkover 3.
        $this->assertSame([$a->id, $cc->id, $b->id], array_slice($this->standings($t), 0, 3));
    }

    public function test_stalled_third_place_auto_resolves_by_rating_to_unblock_final(): void
    {
        // TAKILMA ÖNLEME: 3.'lük iki oyunculu HAZIR ama kimse odayı açmadı + süre doldu -> rating ile
        // 3. belirlenir, FINAL gate'i açılır (turnuva 3.'lükte asılı kalmaz).
        $a = $this->user('a');
        $b = $this->user('b');
        $cc = $this->user('c');
        $d = $this->user('d');
        $p = fn (User $u, int $r) => ['id' => $u->id, 'name' => strtoupper($u->nickname), 'rating' => $r];

        $t = Tournament::create([
            'name' => 'T', 'size' => 4, 'status' => 'running', 'active' => true,
            'players' => [$p($a, 1500), $p($b, 1500), $p($cc, 1500), $p($d, 1600)],
            'bracket' => [
                [
                    ['key' => 'r0m0', 'p1' => $p($a, 1500), 'p2' => $p($b, 1500), 'winner' => null],
                    ['key' => 'r0m1', 'p1' => $p($cc, 1500), 'p2' => $p($d, 1600), 'winner' => null],
                ],
                [['key' => 'r1m0', 'p1' => null, 'p2' => null, 'winner' => null]],
            ],
        ]);
        $this->apply($t, 0, 0, $a->id);   // B -> 3.'lük
        $this->apply($t, 0, 1, $cc->id);  // D (1600) -> 3.'lük
        $t->refresh();

        // Kimse odayı açmadı; ready_at'i 11 dk geçmişe çek (stall eşiği 10 dk).
        $bk = $t->bracket;
        $bk[1][1]['ready_at'] = now()->subMinutes(11)->toIso8601String();
        $t->bracket = $bk;
        $t->save();

        $this->assertTrue($this->callPrivate($t, 'resolveStalledThirdPlace'));
        $t->refresh();
        $this->assertSame($d->id, (int) $t->bracket[1][1]['winner']); // yüksek rating (D) 3.

        // FINAL artık AÇIK (opens_at yok, 3.'lük çözüldü) -> matchRoom başarılı.
        Sanctum::actingAs($a);
        $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => 'r1m0'])
            ->assertOk()
            ->assertJsonStructure(['code']);
    }

    public function test_final_is_not_decided_while_third_place_is_being_played(): void
    {
        // A-19: 3.'lük oynanırken final henüz AÇIK DEĞİL -> finalin stall sayacı işlememeli; eskiden
        // 3 dk sonra final rating ile karara bağlanıp yanlış şampiyon belirleniyordu.
        [$a, $b, $cc, $d] = [$this->user('a'), $this->user('b'), $this->user('c'), $this->user('d')];
        $p = fn (User $u, int $r) => ['id' => $u->id, 'name' => strtoupper($u->nickname), 'rating' => $r];
        $t = Tournament::create([
            'name' => 'T', 'size' => 4, 'status' => 'running', 'active' => true,
            'players' => [$p($a, 1500), $p($b, 1500), $p($cc, 1900), $p($d, 1500)],
            'bracket' => [
                [
                    ['key' => 'r0m0', 'p1' => $p($a, 1500), 'p2' => $p($b, 1500), 'winner' => null],
                    ['key' => 'r0m1', 'p1' => $p($cc, 1900), 'p2' => $p($d, 1500), 'winner' => null],
                ],
                [['key' => 'r1m0', 'p1' => null, 'p2' => null, 'winner' => null]],
            ],
        ]);
        $this->apply($t, 0, 0, $a->id);
        $this->apply($t, 0, 1, $cc->id);
        $t->refresh();
        // Final hazır görünür ve süre çoktan dolmuş gibi damgalı; 3.'lük hâlâ oynanıyor.
        $bk = $t->bracket;
        $bk[1][0]['ready_at'] = now()->subMinutes(30)->toIso8601String();
        $t->bracket = $bk;
        $t->save();

        $this->callPrivate($t, 'resolveStalledMatches');
        $t->refresh();
        $this->assertEmpty($t->bracket[1][0]['winner'] ?? null, 'final 3.\'lük bitmeden karara bağlanmamalı');
        $this->assertNull($t->champion_id);

        // 3.'lük bitti -> final 1 dk sonra açılır; açıldığı an oyunculara YENİ gelme süresi verilir.
        $this->apply($t, 1, 1, $b->id);
        $t->refresh();
        $this->travel(2)->minutes();
        $this->callPrivate($t, 'resolveStalledMatches');
        $t->refresh();
        $this->assertEmpty($t->bracket[1][0]['winner'] ?? null, 'gate açılınca hemen hükmen verilmemeli');
    }

    public function test_disqualified_player_waiting_for_opponent_loses_when_opponent_arrives(): void
    {
        // A-23: rakibi henüz belli olmayan oyuncu diskalifiye edilince eskiden hiçbir şey olmuyordu;
        // oyuncu finale çıkıp ödül alabiliyordu.
        [$a, $b, $cc, $d] = [$this->user('a'), $this->user('b'), $this->user('c'), $this->user('d')];
        $admin = $this->user('adm');
        $admin->forceFill(['is_admin' => true])->save();
        $p = fn (User $u) => ['id' => $u->id, 'name' => strtoupper($u->nickname), 'rating' => 1500];
        $t = Tournament::create([
            'name' => 'T', 'size' => 4, 'status' => 'running', 'active' => true,
            'players' => [$p($a), $p($b), $p($cc), $p($d)],
            'bracket' => [
                [
                    ['key' => 'r0m0', 'p1' => $p($a), 'p2' => $p($b), 'winner' => null],
                    ['key' => 'r0m1', 'p1' => $p($cc), 'p2' => $p($d), 'winner' => null],
                ],
                [['key' => 'r1m0', 'p1' => null, 'p2' => null, 'winner' => null]],
            ],
        ]);
        $this->apply($t, 0, 0, $a->id); // A finalde, rakibi bekliyor
        Sanctum::actingAs($admin);
        $this->postJson("/api/tournaments/{$t->id}/disqualify", ['user_id' => $a->id])->assertSuccessful();
        $t->refresh();
        $this->apply($t, 0, 1, $cc->id); // rakip (C) finale geldi
        $t->refresh();
        $this->assertSame($cc->id, (int) $t->bracket[1][0]['winner'], 'diskalifiye oyuncunun rakibi hükmen kazanmalı');
        $this->assertSame($cc->id, (int) $t->champion_id);
    }
}
