<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\Team;
use App\Models\TeamMatch;
use App\Models\TeamMatchGame;
use App\Models\TeamMember;
use App\Models\User;
use App\Support\TeamLeague\TeamException;
use App\Support\TeamLeague\TeamMatchRuntime;
use App\Support\TeamLeague\TeamRules;
use App\Support\TeamLeague\TeamService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Takımlar Ligi Faz 2 — karşılaşma runtime (§7-§9): takvim/onay kuralları, gizli kadro doğrulaması,
 * 10dk kilit (eksik kadro hükmen/iptal), 5dk hazır-olma no-show/çift-hükmen, skor hesabı, oda→rating.
 */
class TeamMatchRuntimeTest extends TestCase
{
    use RefreshDatabase;

    private function rt(): TeamMatchRuntime
    {
        return app(TeamMatchRuntime::class);
    }

    private function eligibleUser(): User
    {
        $u = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'coins' => 100_000, 'rating' => 1500]);
        for ($i = 0; $i < TeamRules::MIN_RATED_MATCHES; $i++) {
            MatchResult::create(['user_id' => $u->id, 'won' => true, 'rated' => true,
                'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0]);
        }

        return $u->fresh();
    }

    /** @return array{0: Team, 1: list<User>} founder + $extra premium üye */
    private function teamWithMembers(string $name, string $tag, int $extra = 5): array
    {
        $founder = $this->eligibleUser();
        $team = app(TeamService::class)->createTeam($founder, ['name' => $name, 'tag' => $tag]);
        $users = [$founder];
        for ($i = 0; $i < $extra; $i++) {
            $u = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'rating' => 1500]);
            TeamMember::create(['team_id' => $team->id, 'user_id' => $u->id, 'role' => 'member', 'joined_at' => now()]);
            $users[] = $u;
        }
        app(TeamService::class)->recompute($team);

        return [$team->fresh(), $users];
    }

    private function scheduledMatch(array $home, array $away, Carbon $at): TeamMatch
    {
        [$homeTeam, $homeUsers] = $home;
        [$awayTeam, $awayUsers] = $away;
        $m = TeamMatch::create([
            'home_team_id' => $homeTeam->id, 'away_team_id' => $awayTeam->id, 'proposed_by_team_id' => $homeTeam->id,
            'scheduled_at' => $at, 'status' => 'scheduled', 'accepted_at' => now(), 'month_key' => $at->format('Y-m'),
        ]);
        $five = fn ($users) => array_slice(array_map(fn ($u) => $u->id, $users), 0, 5);
        $this->rt()->setLineup($m, $homeTeam->id, $homeUsers[0]->id, $five($homeUsers));
        $this->rt()->setLineup($m, $awayTeam->id, $awayUsers[0]->id, $five($awayUsers));

        return $m->fresh();
    }

    // ---- §7 Takvim ---------------------------------------------------------

    public function test_propose_and_accept_schedules_match(): void
    {
        [$home, $hu] = $this->teamWithMembers('Evciler', 'EV');
        [$away, $au] = $this->teamWithMembers('Deplas', 'DEP');
        $at = now()->addHours(2);
        $m = $this->rt()->proposeMatch($home, $away, $at, $hu[0]->id);
        $this->assertSame('proposed', $m->status);

        $this->rt()->acceptMatch($m->fresh(), $au[0]->id);
        $m->refresh();
        $this->assertSame('scheduled', $m->status);
        $this->assertSame($at->format('Y-m'), $m->month_key);
    }

    public function test_accept_rejects_when_under_one_hour(): void
    {
        [$home, $hu] = $this->teamWithMembers('Evciler', 'EV');
        [$away, $au] = $this->teamWithMembers('Deplas', 'DEP');
        $m = $this->rt()->proposeMatch($home, $away, now()->addMinutes(30), $hu[0]->id);
        $this->assertThrowsCode('too_soon', fn () => $this->rt()->acceptMatch($m->fresh(), $au[0]->id));
    }

    public function test_max_three_active_matches(): void
    {
        [$home, $hu] = $this->teamWithMembers('Evciler', 'EV');
        // 3 onaylı maçı doğrudan ekle (farklı rakip + uzak saatler).
        for ($i = 1; $i <= 3; $i++) {
            $opp = $this->teamWithMembers("Rakip$i", "R$i")[0];
            TeamMatch::create(['home_team_id' => $home->id, 'away_team_id' => $opp->id, 'proposed_by_team_id' => $home->id,
                'scheduled_at' => now()->addDays($i), 'status' => 'scheduled', 'accepted_at' => now()]);
        }
        [$away, $au] = $this->teamWithMembers('Deplas', 'DEP');
        $m = $this->rt()->proposeMatch($home, $away, now()->addDays(10), $hu[0]->id);
        $this->assertThrowsCode('too_many_active_matches', fn () => $this->rt()->acceptMatch($m->fresh(), $au[0]->id));
    }

    public function test_rematch_cooldown_blocks_within_72h(): void
    {
        [$home, $hu] = $this->teamWithMembers('Evciler', 'EV');
        [$away, $au] = $this->teamWithMembers('Deplas', 'DEP');
        TeamMatch::create(['home_team_id' => $home->id, 'away_team_id' => $away->id, 'status' => 'finished',
            'result' => 'home_win', 'finished_at' => now()->subHours(10)]);
        $m = $this->rt()->proposeMatch($home, $away, now()->addDays(1), $hu[0]->id);
        $this->assertThrowsCode('rematch_cooldown', fn () => $this->rt()->acceptMatch($m->fresh(), $au[0]->id));
    }

    // ---- §8 Kadro ----------------------------------------------------------

    public function test_lineup_validation(): void
    {
        [$home, $hu] = $this->teamWithMembers('Evciler', 'EV');
        [$away, $au] = $this->teamWithMembers('Deplas', 'DEP');
        $m = TeamMatch::create(['home_team_id' => $home->id, 'away_team_id' => $away->id, 'scheduled_at' => now()->addHours(2), 'status' => 'scheduled']);
        $ids = array_map(fn ($u) => $u->id, $hu);

        $this->assertThrowsCode('lineup_size', fn () => $this->rt()->setLineup($m, $home->id, $hu[0]->id, array_slice($ids, 0, 4)));
        $this->assertThrowsCode('duplicate_player', fn () => $this->rt()->setLineup($m, $home->id, $hu[0]->id, [$ids[0], $ids[0], $ids[1], $ids[2], $ids[3]]));
        $outsider = $au[1]->id;
        $this->assertThrowsCode('not_a_member', fn () => $this->rt()->setLineup($m, $home->id, $hu[0]->id, [$ids[0], $ids[1], $ids[2], $ids[3], $outsider]));
    }

    public function test_lock_one_side_incomplete_forfeits_zero_five_no_games(): void
    {
        $home = $this->teamWithMembers('Evciler', 'EV');
        $away = $this->teamWithMembers('Deplas', 'DEP');
        $m = $this->scheduledMatch($home, $away, now()->addMinutes(8));
        // Ev kadrosundan bir oyuncu Premium kaybetsin → ev eksik.
        $home[1][1]->forceFill(['plan' => 'free', 'plan_until' => null])->save();

        $this->rt()->lockMatch($m->fresh(), now());
        $m->refresh();
        $this->assertSame('finished', $m->status);
        $this->assertSame('away_win', $m->result);
        $this->assertEqualsWithDelta(0.0, $m->home_score, 1e-9);
        $this->assertEqualsWithDelta(5.0, $m->away_score, 1e-9);
        $this->assertSame(0, TeamMatchGame::where('match_id', $m->id)->count()); // oyun yok → rating yok
    }

    public function test_lock_both_incomplete_cancels(): void
    {
        $home = $this->teamWithMembers('Evciler', 'EV');
        $away = $this->teamWithMembers('Deplas', 'DEP');
        $m = $this->scheduledMatch($home, $away, now()->addMinutes(8));
        $home[1][1]->forceFill(['plan' => 'free', 'plan_until' => null])->save();
        $away[1][1]->forceFill(['plan' => 'free', 'plan_until' => null])->save();

        $this->rt()->lockMatch($m->fresh(), now());
        $this->assertSame('cancelled', $m->fresh()->status);
    }

    public function test_lock_creates_five_games(): void
    {
        $m = $this->lockedMatch();
        $this->assertNotNull($m->lineup_locked_at);
        $this->assertSame(5, TeamMatchGame::where('match_id', $m->id)->count());
    }

    // ---- §9 Hazır-olma / sonuç ---------------------------------------------

    public function test_ready_window_one_present_forfeit_other_absent(): void
    {
        $m = $this->lockedMatch();
        $game = TeamMatchGame::where('match_id', $m->id)->where('slot', 1)->first();
        $after = $m->scheduled_at->copy()->addMinutes(TeamRules::READY_WINDOW_MINUTES + 1);
        $game->update(['ready_home_at' => $after]); // yalnız ev hazır
        $res = $this->rt()->resolveGameReadyWindow($m, $game->fresh(), $after);
        $this->assertSame('home', $res);
        $this->assertSame((int) $game->home_user_id, (int) $game->fresh()->winner_user_id);
        $this->assertNull($game->fresh()->started_at); // oda açılmadı → rating yok
    }

    public function test_all_noshow_double_forfeit(): void
    {
        $m = $this->lockedMatch();
        $after = $m->scheduled_at->copy()->addMinutes(TeamRules::READY_WINDOW_MINUTES + 1);
        foreach (TeamMatchGame::where('match_id', $m->id)->get() as $g) {
            $this->rt()->resolveGameReadyWindow($m->fresh(), $g, $after);
        }
        $m->refresh();
        $this->assertSame('finished', $m->status);
        $this->assertSame('double_forfeit', $m->result); // 2½-2½ beraberlik DEĞİL (§9)
        $this->assertEqualsWithDelta(0.0, $m->home_score, 1e-9);
        $this->assertEqualsWithDelta(0.0, $m->away_score, 1e-9);
    }

    public function test_finalize_score_computation_with_half_point(): void
    {
        $m = $this->lockedMatch();
        $games = TeamMatchGame::where('match_id', $m->id)->orderBy('slot')->get();
        $results = ['home', 'home', 'home', 'away', 'draw'];
        foreach ($games as $i => $g) {
            $g->update(['status' => 'finished', 'result' => $results[$i],
                'winner_user_id' => $results[$i] === 'home' ? $g->home_user_id : ($results[$i] === 'away' ? $g->away_user_id : null)]);
        }
        $this->rt()->tryFinalize((int) $m->id);
        $m->refresh();
        $this->assertSame('home_win', $m->result);
        $this->assertEqualsWithDelta(3.5, $m->home_score, 1e-9); // 3 galibiyet + ½
        $this->assertEqualsWithDelta(1.5, $m->away_score, 1e-9); // 1 galibiyet + ½
    }

    public function test_capture_game_result_from_verified_room(): void
    {
        $m = $this->lockedMatch();
        $game = TeamMatchGame::where('match_id', $m->id)->where('slot', 1)->first();
        $game->update(['room_code' => 'TST01', 'status' => 'live', 'started_at' => now()]);
        (new Room)->forceFill([
            'code' => 'TST01', 'status' => 'finished', 'authoritative' => true, 'bot' => false,
            'p1_token' => 't1', 'p2_token' => 't2', 'p1_name' => 'Ev', 'p2_name' => 'Dep',
            'p1_user_id' => $game->home_user_id, 'p2_user_id' => $game->away_user_id,
            'server_match' => ['done' => true, 'winner' => 'white'],
        ])->save();

        $this->assertTrue($this->rt()->captureGameResult($game->fresh()));
        $this->assertSame('home', $game->fresh()->result);
        $this->assertSame((int) $game->home_user_id, (int) $game->fresh()->winner_user_id);
    }

    public function test_mutual_cancel_requires_both_managers(): void
    {
        [$home, $hu] = $this->teamWithMembers('Evciler', 'EV');
        [$away, $au] = $this->teamWithMembers('Deplas', 'DEP');
        $m = TeamMatch::create(['home_team_id' => $home->id, 'away_team_id' => $away->id, 'proposed_by_team_id' => $home->id,
            'scheduled_at' => now()->addHours(5), 'status' => 'scheduled', 'accepted_at' => now()]);

        $this->assertSame('pending', $this->rt()->cancelMatch($m->fresh(), $hu[0]->id));
        $this->assertSame('scheduled', $m->fresh()->status);
        $this->assertSame('cancelled', $this->rt()->cancelMatch($m->fresh(), $au[0]->id));
        $this->assertSame('cancelled', $m->fresh()->status);
    }

    // ---- yardımcılar -------------------------------------------------------

    private function lockedMatch(): TeamMatch
    {
        $home = $this->teamWithMembers('Evciler', 'EV');
        $away = $this->teamWithMembers('Deplas', 'DEP');
        $m = $this->scheduledMatch($home, $away, now()->addMinutes(8));
        $this->rt()->lockMatch($m->fresh(), now());

        return $m->fresh();
    }

    private function assertThrowsCode(string $code, callable $fn): void
    {
        try {
            $fn();
            $this->fail("TeamException($code) beklendi ama atılmadı");
        } catch (TeamException $e) {
            $this->assertSame($code, $e->errorCode, "beklenen '$code', gelen '{$e->errorCode}'");
        }
    }
}
