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

        // OTOMATİK BAŞLAR: 3.'lük maçı için oda kodu üretilebilmeli (oyuncu girince başlar).
        Sanctum::actingAs($b);
        $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => 'r1m1'])
            ->assertOk()
            ->assertJsonStructure(['code']);

        // Final: A şampiyon. 3.'lük OYNANMADIĞI için turnuva HÂLÂ kapanmamalı.
        $this->apply($t, 1, 0, $a->id);
        $t->refresh();
        $this->assertSame($a->id, (int) $t->champion_id);
        $this->assertSame('running', $t->status, 'final bitse de 3.lük bitmeden turnuva kapanmamalı');

        // 3.'lük maçı: B yener D -> B 3., D 4.; turnuva şimdi kapanır.
        $this->apply($t, 1, 1, $b->id);
        $t->refresh();
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
}
