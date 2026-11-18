<?php

namespace Tests\Feature;

use App\Filament\Resources\LeagueSeasonResource\Pages\ListLeagueSeasons;
use App\Models\LeagueParticipant;
use App\Models\LeagueSeason;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/** Sezon silme: aktif sezon silinemez (buton gizli); draft/finished silinir + bağlılar cascade. */
class LeagueSeasonDeleteTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::create([
            'nickname' => 'lgadm', 'email' => 'lgadm@e.com', 'password' => bcrypt('secret123'),
            'first_name' => 'A', 'last_name' => 'D', 'country' => 'TR',
        ]);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    public function test_draft_season_deletes_and_cascades_participants(): void
    {
        $this->actingAs($this->admin());

        $s = LeagueSeason::create(['name' => 'Taslak', 'status' => 'draft']);
        LeagueParticipant::create(['season_id' => $s->id, 'user_id' => 7001, 'status' => 'pending']);

        Livewire::test(ListLeagueSeasons::class)
            ->assertTableActionVisible('delete', $s)
            ->callTableAction('delete', $s);

        $this->assertNull(LeagueSeason::find($s->id));
        $this->assertSame(0, LeagueParticipant::where('season_id', $s->id)->count());
    }

    public function test_active_season_delete_is_hidden(): void
    {
        $this->actingAs($this->admin());

        $s = LeagueSeason::create(['name' => 'Aktif', 'status' => 'league', 'active_lock' => 1]);

        Livewire::test(ListLeagueSeasons::class)->assertTableActionHidden('delete', $s);

        $this->assertNotNull(LeagueSeason::find($s->id));
    }
}
