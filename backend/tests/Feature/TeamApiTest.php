<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Team;
use App\Models\TeamMatch;
use App\Models\TeamMember;
use App\Models\User;
use App\Support\TeamLeague\TeamMatchRuntime;
use App\Support\TeamLeague\TeamRules;
use App\Support\TeamLeague\TeamService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Takımlar Ligi Faz 3 — API: auth kapıları, TeamException→4xx eşleme, admin koruması ve KRİTİK
 * gizli-kadro serileştirme gate'i (rakip kadro kilide kadar herkese açık/rakip görünümde SIZMAZ).
 */
class TeamApiTest extends TestCase
{
    use RefreshDatabase;

    private function eligibleUser(): User
    {
        $u = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'coins' => 100_000, 'rating' => 1500]);
        for ($i = 0; $i < TeamRules::MIN_RATED_MATCHES; $i++) {
            MatchResult::create(['user_id' => $u->id, 'won' => true, 'rated' => true,
                'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0]);
        }

        return $u->fresh();
    }

    /** @return array{0: Team, 1: list<User>} */
    private function teamWithMembers(string $name, string $tag): array
    {
        $founder = $this->eligibleUser();
        $team = app(TeamService::class)->createTeam($founder, ['name' => $name, 'tag' => $tag]);
        $users = [$founder];
        for ($i = 0; $i < 5; $i++) {
            $u = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'rating' => 1500]);
            TeamMember::create(['team_id' => $team->id, 'user_id' => $u->id, 'role' => 'member', 'joined_at' => now()]);
            $users[] = $u;
        }
        app(TeamService::class)->recompute($team);

        return [$team->fresh(), $users];
    }

    public function test_public_ranking_is_open_to_guests(): void
    {
        $this->getJson('/api/teams')->assertOk()->assertJsonStructure(['ranking', 'rules']);
    }

    public function test_my_team_requires_auth(): void
    {
        $this->getJson('/api/my-team')->assertUnauthorized();
    }

    public function test_create_team_via_api(): void
    {
        Sanctum::actingAs($this->eligibleUser());
        $this->postJson('/api/teams', ['name' => 'Kartallar', 'tag' => 'KRT'])
            ->assertCreated()->assertJsonPath('team.tag', 'KRT');
        $this->assertSame(1, Team::count());
    }

    public function test_create_without_premium_maps_to_403_code(): void
    {
        $u = User::factory()->create(['plan' => 'free', 'plan_until' => null, 'coins' => 100_000, 'rating' => 1500]);
        Sanctum::actingAs($u);
        $this->postJson('/api/teams', ['name' => 'Kartallar', 'tag' => 'KRT'])
            ->assertStatus(403)->assertJsonPath('error', 'premium_required');
    }

    public function test_admin_index_blocks_non_admin(): void
    {
        Sanctum::actingAs($this->eligibleUser());
        $this->getJson('/api/admin/teams')->assertStatus(403);
    }

    public function test_secret_lineup_hidden_until_lock(): void
    {
        [$home, $hu] = $this->teamWithMembers('Evciler', 'EV');
        [$away, $au] = $this->teamWithMembers('Deplas', 'DEP');
        $rt = app(TeamMatchRuntime::class);
        $m = TeamMatch::create(['home_team_id' => $home->id, 'away_team_id' => $away->id, 'proposed_by_team_id' => $home->id,
            'scheduled_at' => now()->addMinutes(8), 'status' => 'scheduled', 'accepted_at' => now()]);
        $five = fn ($users) => array_slice(array_map(fn ($u) => $u->id, $users), 0, 5);
        $rt->setLineup($m, $home->id, $hu[0]->id, $five($hu));
        $rt->setLineup($m, $away->id, $au[0]->id, $five($au));

        // Kilitten ÖNCE: herkese açık sayfada kadro/oyun YOK (gizli).
        $pre = $this->getJson("/api/team-matches/{$m->id}")->assertOk()->json('match');
        $this->assertFalse($pre['lineup_revealed']);
        $this->assertArrayNotHasKey('games', $pre);

        // Rakip yöneticisinin görünümünde de rakip (ev) kadrosu SIZMAZ (yalnız kendi kadrosu + oyun yok).
        Sanctum::actingAs($au[0]);
        $mine = $this->getJson("/api/team-matches/{$m->id}/mine")->assertOk()->json('match');
        $this->assertSame($away->id, $mine['my_team_id']);
        $this->assertArrayNotHasKey('games', $mine); // kilit yok → eşleşmeler açılmadı (rakip kadro taşıyan tek alan)
        // my_lineup YALNIZ kendi (deplasman) oyuncularını taşır; hiçbir ev oyuncusu sızmaz.
        $myLineupIds = array_map(fn ($r) => $r['user']['id'], $mine['my_lineup']);
        $homeIds = $five($hu);
        $this->assertEmpty(array_intersect($myLineupIds, $homeIds), 'rakip (ev) kadro oyuncusu sızdı');
        $this->assertEqualsCanonicalizing($five($au), $myLineupIds);

        // Kilitten SONRA: kadrolar + 5 oyun herkese açık.
        $rt->lockMatch($m->fresh(), now());
        $post = $this->getJson("/api/team-matches/{$m->id}")->assertOk()->json('match');
        $this->assertTrue($post['lineup_revealed']);
        $this->assertCount(5, $post['games']);
    }

    public function test_application_flow_over_http(): void
    {
        [$team, $members] = $this->teamWithMembers('Evciler', 'EV');
        $applicant = $this->eligibleUser();

        Sanctum::actingAs($applicant);
        $appId = $this->postJson("/api/teams/{$team->id}/apply")->assertOk()->json('id');

        Sanctum::actingAs($members[0]); // kurucu kabul eder
        $this->postJson("/api/team-applications/{$appId}/decide", ['accept' => true])->assertOk();
        $this->assertSame('member', TeamMember::where('user_id', $applicant->id)->value('role'));
    }
}
