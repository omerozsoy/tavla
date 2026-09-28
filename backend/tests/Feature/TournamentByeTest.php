<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Bye'lar: agac kayitli oyuncu sayisina gore kurulur (kapasiteye gore degil) ve rakibi hic
// gelemeyecek oyuncu (karsi dal olu) otomatik ilerler -> turnuva takilmaz.
class TournamentByeTest extends TestCase
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

    public function test_bracket_is_sized_by_players_not_capacity(): void
    {
        $players = [];
        foreach (range(1, 6) as $i) {
            $u = $this->user("p{$i}");
            $players[] = ['id' => $u->id, 'name' => "P{$i}", 'rating' => 1500];
        }
        $t = Tournament::create(['name' => 'T', 'size' => 16, 'status' => 'open', 'players' => $players]);
        $t->startBracket();
        $b = $t->fresh()->bracket;

        $this->assertCount(3, $b);    // 8'lik agac: ceyrek, yari, final
        $this->assertCount(4, $b[0]);
        $byes = 0;
        foreach ($b[0] as $m) {
            $this->assertTrue(! empty($m['p1']) || ! empty($m['p2']), 'ilk turda "— vs —" olmamali');
            if (empty($m['p1']) || empty($m['p2'])) {
                $byes++;
            }
        }
        $this->assertSame(2, $byes);
    }

    public function test_player_facing_dead_branch_advances_automatically(): void
    {
        $a = $this->user('a');
        $b = $this->user('b');
        $pa = ['id' => $a->id, 'name' => 'A'];
        $pb = ['id' => $b->id, 'name' => 'B'];
        // Eski (kapasiteye gore) agac: B yari finalde, karsi dal olu -> B finale gecmeli.
        $t = Tournament::create([
            'name' => 'T', 'size' => 8, 'status' => 'running', 'active' => true,
            'players' => [$pa, $pb],
            'bracket' => [
                [
                    ['key' => 'r0m0', 'p1' => $pa, 'p2' => null, 'winner' => $a->id],
                    ['key' => 'r0m1', 'p1' => null, 'p2' => null, 'winner' => null],
                    ['key' => 'r0m2', 'p1' => $pb, 'p2' => null, 'winner' => $b->id],
                    ['key' => 'r0m3', 'p1' => null, 'p2' => null, 'winner' => null],
                ],
                [
                    ['key' => 'r1m0', 'p1' => $pa, 'p2' => null, 'winner' => null],
                    ['key' => 'r1m1', 'p1' => $pb, 'p2' => null, 'winner' => null],
                ],
                [['key' => 'r2m0', 'p1' => null, 'p2' => null, 'winner' => null]],
            ],
        ]);

        $this->getJson("/api/tournaments/{$t->id}")->assertOk();
        $f = $t->fresh()->bracket;
        $this->assertSame($a->id, $f[1][0]['winner']);
        $this->assertSame($b->id, $f[1][1]['winner']);
        $this->assertSame($a->id, $f[2][0]['p1']['id']); // final A vs B
        $this->assertSame($b->id, $f[2][0]['p2']['id']);
        $this->assertNull($f[2][0]['winner']);           // final oynanacak
    }
}
