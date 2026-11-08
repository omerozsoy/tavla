<?php

namespace Tests\Feature;

use App\Filament\Resources\TeamMatchResource\Pages\ListTeamMatches;
use App\Filament\Resources\TeamResource\Pages\ListTeams;
use App\Models\MatchResult;
use App\Models\Team;
use App\Models\TeamMatch;
use App\Models\User;
use App\Support\TeamLeague\TeamRules;
use App\Support\TeamLeague\TeamService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Takımlar Ligi Faz 4 — Filament admin: erişim koruması + logo onay/ret + maç iptal/sonuç düzeltme
 * aksiyonları (TeamService/TeamMatchRuntime üzerinden). Kullanıcının göremeyeceği, adminin görebileceği.
 */
class TeamFilamentTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::factory()->create();
        $u->forceFill(['is_admin' => true])->save();

        return $u->fresh();
    }

    private function founderTeam(string $name = 'Kartallar', string $tag = 'KRT'): Team
    {
        $f = User::factory()->create(['plan' => 'premium', 'plan_until' => now()->addYear(), 'coins' => 100_000, 'rating' => 1500]);
        for ($i = 0; $i < TeamRules::MIN_RATED_MATCHES; $i++) {
            MatchResult::create(['user_id' => $f->id, 'won' => true, 'rated' => true,
                'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0]);
        }

        return app(TeamService::class)->createTeam($f->fresh(), ['name' => $name, 'tag' => $tag]);
    }

    public function test_non_admin_cannot_open_team_panel(): void
    {
        $plain = User::factory()->create();
        $this->actingAs($plain)->get('/admin/teams')->assertForbidden();
    }

    public function test_admin_sees_teams_list(): void
    {
        $team = $this->founderTeam();
        Livewire::actingAs($this->admin())->test(ListTeams::class)
            ->assertCanSeeTableRecords([$team]);
    }

    public function test_admin_approves_pending_logo(): void
    {
        $team = $this->founderTeam();
        $team->update(['logo_pending' => 'uploads/x.webp']);

        Livewire::actingAs($this->admin())->test(ListTeams::class)
            ->callTableAction('approveLogo', $team);

        $team->refresh();
        $this->assertSame('uploads/x.webp', $team->logo);
        $this->assertNull($team->logo_pending);
    }

    public function test_admin_rejects_pending_logo(): void
    {
        $team = $this->founderTeam();
        $team->update(['logo' => 'old.webp', 'logo_pending' => 'uploads/x.webp']);

        Livewire::actingAs($this->admin())->test(ListTeams::class)
            ->callTableAction('rejectLogo', $team);

        $team->refresh();
        $this->assertSame('old.webp', $team->logo);
        $this->assertNull($team->logo_pending);
    }

    public function test_admin_cancels_and_corrects_match(): void
    {
        $home = $this->founderTeam('Evciler', 'EV');
        $away = $this->founderTeam('Deplas', 'DEP');
        $scheduled = TeamMatch::create(['home_team_id' => $home->id, 'away_team_id' => $away->id,
            'scheduled_at' => now()->addDay(), 'status' => 'scheduled']);

        Livewire::actingAs($this->admin())->test(ListTeamMatches::class)
            ->callTableAction('cancel', $scheduled, data: ['reason' => 'test iptal']);
        $this->assertSame('cancelled', $scheduled->fresh()->status);

        $finished = TeamMatch::create(['home_team_id' => $home->id, 'away_team_id' => $away->id,
            'status' => 'finished', 'result' => 'away_win', 'home_score' => 1, 'away_score' => 4, 'month_key' => now()->format('Y-m')]);

        Livewire::actingAs($this->admin())->test(ListTeamMatches::class)
            ->callTableAction('correct', $finished, data: [
                'result' => 'home_win', 'home_score' => 5, 'away_score' => 0, 'reason' => 'yanlış girildi',
            ]);
        $finished->refresh();
        $this->assertSame('home_win', $finished->result);
        $this->assertEqualsWithDelta(5.0, $finished->home_score, 1e-9);
    }

    public function test_admin_edits_team_identity(): void
    {
        $team = $this->founderTeam('Kartallar', 'KRT');

        Livewire::actingAs($this->admin())->test(ListTeams::class)
            ->callTableAction('edit', $team, data: [
                'name' => 'Şahinler', 'tag' => 'SHN', 'color1' => '#112233', 'description' => 'yeni',
            ]);

        $team->refresh();
        $this->assertSame('Şahinler', $team->name);
        $this->assertSame('shn', $team->tag_key);
        $this->assertSame('#112233', $team->color1);
        $this->assertSame('yeni', $team->description);
    }

    public function test_admin_edit_rejects_duplicate_tag(): void
    {
        $a = $this->founderTeam('Alfa', 'ALF');
        $this->founderTeam('Beta', 'BET');

        Livewire::actingAs($this->admin())->test(ListTeams::class)
            ->callTableAction('edit', $a, data: ['name' => 'Alfa', 'tag' => 'BET']);

        $this->assertSame('ALF', $a->fresh()->tag); // çakışma reddedildi, değişmedi
    }

    public function test_admin_creates_team_for_user_bypassing_eligibility(): void
    {
        // Premium YOK, puanlı maç YOK, coin YOK — kullanıcı kendi KURAMAZ ama admin kurabilir.
        $founder = User::factory()->create(['coins' => 0, 'rating' => 1500]);

        Livewire::actingAs($this->admin())->test(ListTeams::class)
            ->callAction('adminCreate', data: [
                'founder_id' => $founder->id, 'name' => 'Yıldızlar', 'tag' => 'YLD',
            ]);

        $team = Team::where('tag_key', 'yld')->first();
        $this->assertNotNull($team);
        $this->assertSame($founder->id, $team->founder_id);
        $this->assertSame(1, $team->member_count);
        $this->assertDatabaseHas('team_members', [
            'team_id' => $team->id, 'user_id' => $founder->id, 'role' => 'founder',
        ]);
        // Coin kesilmedi (admin ücretsiz kurdu).
        $this->assertSame(0, (int) $founder->fresh()->coins);
    }
}
