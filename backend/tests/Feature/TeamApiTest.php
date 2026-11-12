<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\TeamSeasonChampion;
use App\Models\User;
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
        $team->update(['status' => 'active']); // yönetim onayı simülasyonu (pending→active)
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

    public function test_team_tags_map_is_public(): void
    {
        [, $members] = $this->teamWithMembers('Evciler', 'EV');
        $this->getJson('/api/team-tags')->assertOk()->assertJsonPath('tags.'.$members[0]->id.'.tag', 'EV');
    }

    public function test_season_champions_are_public(): void
    {
        [$team] = $this->teamWithMembers('Kahramanlar', 'KHR');
        TeamSeasonChampion::create([
            'season_key' => '2026-sonbahar', 'team_id' => $team->id, 'rank' => 1,
            'points' => 42, 'team_name' => $team->name, 'created_at' => now(),
        ]);
        $this->getJson('/api/teams/champions')->assertOk()
            ->assertJsonPath('champions.0.points', 42)
            ->assertJsonPath('champions.0.team.tag', 'KHR');
    }

    public function test_my_team_requires_auth(): void
    {
        $this->getJson('/api/my-team')->assertUnauthorized();
    }

    public function test_pending_logo_flag_only_for_managers(): void
    {
        [$team, $members] = $this->teamWithMembers('Bayrak', 'BYR');
        $team->update(['logo_pending' => 'uploads/pending.webp']);

        // Misafir: bayrak false (gerçek logo_pending URL'i hiç sızmaz).
        $this->getJson('/api/teams/'.$team->id)
            ->assertOk()->assertJsonPath('team.has_pending_logo', false)
            ->assertJsonMissingPath('team.logo_pending');

        // Sıradan üye: yönetici değil → false.
        Sanctum::actingAs($members[1]);
        $this->getJson('/api/teams/'.$team->id)->assertJsonPath('team.has_pending_logo', false);

        // Kurucu (yönetici): true.
        Sanctum::actingAs($members[0]);
        $this->getJson('/api/teams/'.$team->id)->assertJsonPath('team.has_pending_logo', true);
    }

    public function test_pending_logo_flag_clears_after_approval(): void
    {
        [$team, $members] = $this->teamWithMembers('Onay', 'ONY');
        $team->update(['logo_pending' => 'uploads/pending.webp']);

        // Onay öncesi: kurucu bayrağı görür (uyarı görünür).
        Sanctum::actingAs($members[0]);
        $this->getJson('/api/teams/'.$team->id)->assertJsonPath('team.has_pending_logo', true);

        // Admin onaylar: logo_pending → logo, bayrak temizlenir.
        app(TeamService::class)->approveLogo($team->fresh(), $members[0]->id);

        // Onay sonrası: bayrak false (uyarı kaybolur), yeni logo onaylı.
        $this->getJson('/api/teams/'.$team->id)
            ->assertJsonPath('team.has_pending_logo', false)
            ->assertJsonPath('team.logo', 'uploads/pending.webp');
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
