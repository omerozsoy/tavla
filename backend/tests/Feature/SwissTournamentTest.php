<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\User;
use App\Support\Swiss\SwissEngine;
use App\Support\Swiss\SwissRuntime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * 3 Haklı Swiss — Tournament modeli + SwissRuntime entegrasyon testleri (bracket depolama, tur
 * üretimi, eleme, sonlandırma, ödül). Maç sonuçları report()/reconcile()'in yapacağı gibi
 * SwissRuntime::applyResult ile beslenir (Room server_match plumbing gerekmeden).
 */
class SwissTournamentTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick, int $rating = 1500): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'), 'rating' => $rating,
        ]);
    }

    private static int $seq = 0;

    private function makeTournament(int $n, array $extra = []): Tournament
    {
        $players = [];
        $g = ++self::$seq; // benzersiz nickname (aynı testte birden çok turnuva kurulabilir)
        for ($i = 1; $i <= $n; $i++) {
            $u = $this->user("sw{$g}_$i", 1500 + $i);
            $players[] = ['id' => $u->id, 'name' => "sw{$g}_$i", 'rating' => 1500 + $i, 'premium' => false];
        }

        return Tournament::create(array_merge([
            'name' => "Swiss $n",
            'type' => 'swiss_triple',
            'size' => 0,
            'status' => 'open',
            'players' => $players,
            'match_length' => 5,
        ], $extra));
    }

    /** Turnuvayı sonuna kadar sürer; her turdaki gerçek maçlara deterministik kazanan verir. */
    private function runToEnd(Tournament $t): Tournament
    {
        $guard = 0;
        while ($t->status === 'running' && $guard++ < 2000) {
            $t->refresh();
            $bracket = $t->bracket;
            $lastRi = count($bracket) - 1;
            $applied = false;
            foreach ($bracket[$lastRi] as $mi => $m) {
                if (! empty($m['winner'])) {
                    continue; // bay veya işlenmiş
                }
                $x = (int) $m['p1']['id'];
                $y = (int) $m['p2']['id'];
                $h = hexdec(substr(hash('sha256', "{$t->id}:$lastRi:$x:$y"), 0, 8));
                $winner = ($h % 2 === 0) ? $x : $y;
                SwissRuntime::applyResult($t, $lastRi, $mi, $winner, ['p1' => $winner === $x ? 5 : 0, 'p2' => $winner === $y ? 5 : 0], true);
                $t->refresh();
                $applied = true;
                break; // her sonuçtan sonra yeniden değerlendir (tur ilerlemiş olabilir)
            }
            if (! $applied) {
                break;
            }
        }

        return $t->fresh();
    }

    public function test_start_builds_first_round_and_locks_config(): void
    {
        $t = $this->makeTournament(8, ['final_length' => 7]);
        SwissRuntime::start($t);
        $t->refresh();

        $this->assertSame('running', $t->status);
        $this->assertIsArray($t->bracket);
        $this->assertCount(1, $t->bracket, 'İlk tur oluşmalı');
        $this->assertCount(4, $t->bracket[0], '8 oyuncu -> 4 maç, bay yok');
        $state = $t->swiss_state;
        $this->assertSame(1, $state['round']);
        $this->assertSame(7, $state['config']['final_length'], 'Kural seti kilitlenmeli');
        $this->assertSame(5, $state['config']['match_length']);
        // İlk tur hedef puanı normal (final değil).
        $this->assertSame(5, $t->bracket[0][0]['target']);
    }

    public function test_odd_field_gets_exactly_one_bye_cell(): void
    {
        $t = $this->makeTournament(5);
        SwissRuntime::start($t);
        $t->refresh();
        $round = $t->bracket[0];
        $byes = array_filter($round, fn ($m) => ! empty($m['bye']));
        $reals = array_filter($round, fn ($m) => empty($m['bye']));
        $this->assertCount(1, $byes, 'Tek sayıda oyuncuda tam bir bay hücresi');
        $this->assertCount(2, $reals, '5 oyuncu -> 2 gerçek maç + 1 bay');
        $bye = array_values($byes)[0];
        $this->assertNotEmpty($bye['winner'], 'Bay hücresi çözülü (winner set)');
        $this->assertNull($bye['p2']);
        $this->assertTrue($bye['score']['bye']);
    }

    public function test_full_tournament_completes_with_single_champion(): void
    {
        foreach ([2, 3, 4, 5, 7, 8, 16] as $n) {
            $t = $this->makeTournament($n);
            SwissRuntime::start($t);
            $t = $this->runToEnd($t);

            $this->assertSame('finished', $t->status, "$n oyuncu: turnuva bitmeli");
            $this->assertNotNull($t->champion_id, "$n oyuncu: şampiyon olmalı");

            $state = $t->swiss_state;
            $champ = SwissEngine::find($state['participants'], (int) $t->champion_id);
            $this->assertLessThan(3, $champ['losses'], "$n oyuncu: şampiyon <3 mağlubiyet");
            // Elenenler tam 3 mağlubiyet.
            foreach ($state['participants'] as $p) {
                if ($p['status'] === 'eliminated') {
                    $this->assertSame(3, $p['losses'], "$n oyuncu: elenen 3 mağlubiyetli");
                }
            }
        }
    }

    public function test_third_loss_eliminates_and_final_two_uses_final_length(): void
    {
        // 2 oyuncu: final-iki hemen. final_length kullanılmalı.
        $t = $this->makeTournament(2, ['final_length' => 9]);
        SwissRuntime::start($t);
        $t->refresh();
        $this->assertSame(9, $t->bracket[0][0]['target'], 'Son iki oyuncu final uzunluğunu kullanır');

        $t = $this->runToEnd($t);
        $this->assertSame('finished', $t->status);
        $loser = collect($t->swiss_state['participants'])->firstWhere('status', 'eliminated');
        $this->assertSame(3, $loser['losses']);
    }

    public function test_champion_receives_prize_pool(): void
    {
        $t = $this->makeTournament(4, ['prize_coins' => 500]);
        SwissRuntime::start($t);
        $t = $this->runToEnd($t);

        $this->assertSame('finished', $t->status);
        $this->assertTrue((bool) $t->prize_paid, 'Ödül ödendi işaretlenmeli');
        $champ = User::find($t->champion_id);
        $this->assertGreaterThanOrEqual(500, (int) $champ->coins, 'Havuz şampiyona eklenmeli');
    }

    public function test_standings_champion_first(): void
    {
        $t = $this->makeTournament(8);
        SwissRuntime::start($t);
        $t = $this->runToEnd($t);
        $st = SwissRuntime::standings($t);
        $this->assertNotEmpty($st);
        $this->assertSame((int) $t->champion_id, $st[0], 'Sıralamada şampiyon 1.');
    }

    /** İlk bekleyen gerçek maç: [key, p1id, p2id]. */
    private function firstPending(Tournament $t): array
    {
        foreach ($t->bracket as $cells) {
            foreach ($cells as $m) {
                if (empty($m['winner']) && empty($m['double_loss']) && ! empty($m['p1']['id']) && ! empty($m['p2']['id'])) {
                    return [$m['key'], (int) $m['p1']['id'], (int) $m['p2']['id']];
                }
            }
        }
        $this->fail('Bekleyen maç yok');
    }

    public function test_resolve_match_double_loss_marks_both(): void
    {
        $t = $this->makeTournament(4);
        SwissRuntime::start($t);
        $t->refresh();
        [$key, $a, $b] = $this->firstPending($t);

        $this->assertTrue(SwissRuntime::resolveMatch($t, $key, 0), 'Çift mağlubiyet uygulanmalı');
        $t->refresh();

        $parts = collect($t->swiss_state['participants']);
        $this->assertSame(1, (int) $parts->firstWhere('id', $a)['losses'], 'A birer mağlubiyet');
        $this->assertSame(1, (int) $parts->firstWhere('id', $b)['losses'], 'B birer mağlubiyet');
        // Hücre galipsiz ama çözülü.
        $cell = collect($t->bracket)->flatten(1)->firstWhere('key', $key);
        $this->assertTrue($cell['double_loss']);
        $this->assertEmpty($cell['winner'] ?? null);
    }

    public function test_resolve_match_force_winner(): void
    {
        $t = $this->makeTournament(4);
        SwissRuntime::start($t);
        $t->refresh();
        [$key, $a, $b] = $this->firstPending($t);

        $this->assertTrue(SwissRuntime::resolveMatch($t, $key, $a));
        $t->refresh();
        $cell = collect($t->bracket)->flatten(1)->firstWhere('key', $key);
        $this->assertSame($a, (int) $cell['winner']);
        // Hükmen (walkover) → kaybedene mağlubiyet, kazanana gerçek galibiyet SAYILMAZ.
        $parts = collect($t->swiss_state['participants']);
        $this->assertSame(1, (int) $parts->firstWhere('id', $b)['losses']);
        $this->assertSame(0, (int) $parts->firstWhere('id', $a)['realWins']);
    }

    public function test_resolve_match_rejects_already_resolved(): void
    {
        $t = $this->makeTournament(4);
        SwissRuntime::start($t);
        $t->refresh();
        [$key, $a] = $this->firstPending($t);
        SwissRuntime::resolveMatch($t, $key, $a);
        $t->refresh();
        // İkinci kez: zaten çözülü → false.
        $this->assertFalse(SwissRuntime::resolveMatch($t, $key, $a));
        $this->assertFalse(SwissRuntime::resolveMatch($t, 'yokboyle', 0), 'Bilinmeyen maç → false');
    }

    public function test_double_loss_both_eliminated_yields_no_champion(): void
    {
        // 2 oyuncu (final-iki): her ikisi de 2 kez çift-mağlubiyet olursa 3. mağlubiyette ikisi de elenir.
        $t = $this->makeTournament(2);
        SwissRuntime::start($t);
        $t->refresh();
        for ($r = 0; $r < 3; $r++) {
            $t->refresh();
            if ($t->status !== 'running') {
                break;
            }
            [$key] = $this->firstPending($t);
            SwissRuntime::resolveMatch($t, $key, 0); // çift mağlubiyet
        }
        $t->refresh();
        $this->assertSame('finished', $t->status);
        $this->assertNull($t->champion_id, 'İki taraf da elendi → şampiyon yok');
        $this->assertSame('no_champion', $t->swiss_state['note'] ?? null);
    }

    public function test_rounds_never_pair_a_player_twice_in_same_round(): void
    {
        $t = $this->makeTournament(16);
        SwissRuntime::start($t);
        $t = $this->runToEnd($t);
        foreach ($t->bracket as $round) {
            $seen = [];
            foreach ($round as $m) {
                foreach (['p1', 'p2'] as $slot) {
                    $id = $m[$slot]['id'] ?? null;
                    if ($id) {
                        $this->assertArrayNotHasKey($id, $seen, 'Bir oyuncu aynı turda iki kez yer alamaz');
                        $seen[$id] = true;
                    }
                }
            }
        }
    }

    public function test_double_loss_match_cannot_be_replayed_or_applied_again(): void
    {
        // A-21: çift mağlubiyetle kapanan maç "winner" boş kaldığı için oda açılıp tekrar oynanabiliyor
        // ve sonucu İKİNCİ kez işleniyordu (ek galibiyet/mağlubiyet + tur iki kez ilerliyordu).
        $t = $this->makeTournament(4);
        SwissRuntime::start($t);
        $t->refresh();
        [$key, $a, $b] = $this->firstPending($t);
        $this->assertTrue(SwissRuntime::resolveMatch($t, $key, 0));
        $t->refresh();

        \Laravel\Sanctum\Sanctum::actingAs(User::find($a));
        $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => $key])->assertStatus(422);

        foreach ($t->bracket as $ri => $cells) {
            foreach ($cells as $mi => $m) {
                if ($m['key'] === $key) {
                    \Illuminate\Support\Facades\DB::transaction(fn () => SwissRuntime::applyResult($t, $ri, $mi, $a, null, true));
                }
            }
        }
        $t->refresh();
        $parts = collect($t->swiss_state['participants']);
        $this->assertSame(1, (int) $parts->firstWhere('id', $b)['losses'], 'kaybedene ikinci mağlubiyet yazılmamalı');
        $this->assertSame(0, (int) ($parts->firstWhere('id', $a)['wins'] ?? 0), 'ek galibiyet yazılmamalı');
    }

    public function test_concurrent_match_room_requests_keep_both_room_codes(): void
    {
        // A-20: matchRoom bracket JSON'u kilitsiz oku-değiştir-yaz yapıyordu; eşzamanlı iki istekte son
        // yazan diğer maçın oda kodunu siliyordu.
        $t = $this->makeTournament(4);
        SwissRuntime::start($t);
        $t->refresh();
        $cells = array_values(array_filter($t->bracket[0], fn ($m) => ! empty($m['p1']['id']) && ! empty($m['p2']['id'])));
        [$m1, $m2] = [$cells[0], $cells[1]];

        // Yarış: bu istek turnuvayı okuduktan hemen sonra diğer maçın odası commit olur.
        $raced = false;
        Tournament::retrieved(function (Tournament $x) use (&$raced, $t, $m2) {
            if (! $raced && $x->id === $t->id) {
                $raced = true;
                $fresh = Tournament::find($t->id);
                $bk = $fresh->bracket;
                foreach ($bk[0] as $i => $c) {
                    if ($c['key'] === $m2['key']) {
                        $bk[0][$i]['room'] = 'RACE2';
                    }
                }
                \Illuminate\Support\Facades\DB::table('tournaments')->where('id', $t->id)->update(['bracket' => json_encode($bk)]);
            }
        });

        \Laravel\Sanctum\Sanctum::actingAs(User::find((int) $m1['p1']['id']));
        $this->postJson("/api/tournaments/{$t->id}/match-room", ['match' => $m1['key']])->assertOk();

        $rooms = collect(Tournament::find($t->id)->bracket[0])->pluck('room', 'key');
        $this->assertSame('RACE2', $rooms[$m2['key']], 'diğer maçın oda kodu korunmalı');
        $this->assertNotEmpty($rooms[$m1['key']]);
    }

    public function test_no_champion_finish_refunds_paid_fees(): void
    {
        // A-33: şampiyonsuz bitişte giriş ücretleri kayboluyordu.
        $t = $this->makeTournament(2, ['entry_fee' => 100, 'prize_coins' => 200]);
        $players = $t->players;
        foreach ($players as $i => $pl) {
            $players[$i]['fee_paid'] = 100;
        }
        $t->players = $players;
        $t->save();
        SwissRuntime::start($t);
        $t->refresh();
        $before = User::whereIn('id', array_column($players, 'id'))->pluck('coins', 'id');
        $guard = 0;
        while ($t->status === 'running' && $guard++ < 10) {
            [$key] = $this->firstPending($t);
            SwissRuntime::resolveMatch($t, $key, 0);
            $t->refresh();
        }
        $this->assertSame('finished', $t->status);
        $this->assertNull($t->champion_id);
        foreach ($before as $id => $c) {
            $this->assertSame((int) $c + 100, (int) User::find($id)->coins, 'ödenen ücret iade edilmeli');
        }
    }
}
