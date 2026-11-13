<?php

namespace Tests\Feature;

use App\Filament\Resources\TournamentResource\Pages\ListTournaments;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/** "3 Günden Eskileri Arşivle" header action + varsayılan liste arşivlenenleri gizler. */
class TournamentArchiveTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::create([
            'nickname' => 'arc', 'email' => 'arc@e.com', 'password' => bcrypt('secret123'),
            'first_name' => 'A', 'last_name' => 'R', 'country' => 'TR',
        ]);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    public function test_archive_old_hides_only_tournaments_older_than_3_days(): void
    {
        $this->actingAs($this->admin());

        $old = Tournament::create(['name' => 'Eski', 'type' => 'bracket', 'size' => 8, 'status' => 'finished']);
        $old->forceFill(['created_at' => now()->subDays(4)])->save();
        $recent = Tournament::create(['name' => 'Yeni', 'type' => 'bracket', 'size' => 8, 'status' => 'open']);

        Livewire::test(ListTournaments::class)
            ->callTableAction('archiveOld')
            // varsayılan (boş) filtre arşivlenenleri gizler -> eski görünmez, yeni görünür
            ->assertCanNotSeeTableRecords([$old])
            ->assertCanSeeTableRecords([$recent]);

        $this->assertNotNull($old->fresh()->archived_at);
        $this->assertNull($recent->fresh()->archived_at);
    }
}
