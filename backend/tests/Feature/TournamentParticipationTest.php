<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\User;
use App\Support\Swiss\SwissRuntime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * check-in / withdraw / disqualify uç noktaları (HTTP). Swiss Triple Elimination + kayıt-öncesi
 * ortak davranış. Motor mantığı SwissEngineTest/SwissTournamentTest'te; burada auth + akış + walkover.
 */
class TournamentParticipationTest extends TestCase
{
    use RefreshDatabase;

    private static int $seq = 0;

    private function user(string $nick, bool $admin = false): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'), 'rating' => 1500,
        ]);
        if ($admin) {
            $u->is_admin = true; // fillable degil -> dogrudan ata
            $u->save();
        }

        return $u;
    }

    /** @return array{0:Tournament,1:array<int,User>} */
    private function swiss(int $n, string $status = 'open', array $extra = []): array
    {
        $g = ++self::$seq;
        $users = [];
        $players = [];
        for ($i = 1; $i <= $n; $i++) {
            $u = $this->user("part{$g}_$i");
            $users[] = $u;
            $players[] = ['id' => $u->id, 'name' => "part{$g}_$i", 'rating' => 1500 + $i, 'premium' => false];
        }
        $t = Tournament::create(array_merge([
            'name' => "Swiss $n", 'type' => 'swiss_triple', 'size' => 0,
            'status' => $status, 'players' => $players, 'match_length' => 5,
        ], $extra));

        return [$t, $users];
    }

    // ---- disqualify (admin) ------------------------------------------------

    public function test_disqualify_requires_admin(): void
    {
        [$t, $users] = $this->swiss(4);
        SwissRuntime::start($t);
        Sanctum::actingAs($users[0]); // admin değil
        $this->postJson("/api/tournaments/{$t->id}/disqualify", ['user_id' => $users[1]->id])
            ->assertStatus(403);
    }

    public function test_admin_disqualifies_running_player(): void
    {
        [$t, $users] = $this->swiss(4);
        SwissRuntime::start($t);
        $t->refresh();
        [$ri, $mi, $p1, $p2] = $this->firstPendingMatch($t);
        Sanctum::actingAs($this->user('ref', true));

        $this->postJson("/api/tournaments/{$t->id}/disqualify", ['user_id' => $p1])->assertOk();
        $t->refresh();

        $cell = $t->bracket[$ri][$mi];
        $this->assertSame($p2, (int) $cell['winner'], 'DQ edilenin rakibi hükmen ilerler');
        $part = collect($t->swiss_state['participants'])->firstWhere('id', $p1);
        $this->assertSame('dq', $part['status']);
    }

    public function test_admin_disqualifies_before_start_removes_player(): void
    {
        [$t, $users] = $this->swiss(4, 'open', ['entry_fee' => 50]);
        $target = $users[2];
        Sanctum::actingAs($this->user('ref2', true));

        $res = $this->postJson("/api/tournaments/{$t->id}/disqualify", ['user_id' => $target->id])->assertOk();
        $ids = collect($res->json('tournament.players'))->pluck('id')->all();
        $this->assertNotContains($target->id, $ids);
        $this->assertSame(50, (int) $target->fresh()->coins, 'Başlamadan DQ = iade');
    }

    public function test_disqualify_unknown_player_404(): void
    {
        [$t] = $this->swiss(4);
        SwissRuntime::start($t);
        Sanctum::actingAs($this->user('ref3', true));
        $this->postJson("/api/tournaments/{$t->id}/disqualify", ['user_id' => 999999])
            ->assertStatus(404);
    }

    /** İlk kazananı belli olmayan gerçek maç: [ri, mi, p1id, p2id]. */
    private function firstPendingMatch(Tournament $t): array
    {
        foreach ($t->bracket as $ri => $cells) {
            foreach ($cells as $mi => $m) {
                if (empty($m['winner']) && ! empty($m['p1']['id']) && ! empty($m['p2']['id'])) {
                    return [$ri, $mi, (int) $m['p1']['id'], (int) $m['p2']['id']];
                }
            }
        }
        $this->fail('Bekleyen maç bulunamadı');
    }
}
