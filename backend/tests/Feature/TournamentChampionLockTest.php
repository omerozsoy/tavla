<?php

namespace Tests\Feature;

use App\Filament\Resources\TournamentResource\Pages\EditTournament;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Denetim R1: Filament'te champion_id, turnuva BİTTİKTEN sonra elle değiştirilemez olmalı
 * (sıralama/ödüller bracket/swiss_state'ten hesaplanır; champion_id'yi ayrıca düzenlemek
 * gösterilen şampiyonu hesaplanan sıralamayla çeliştirir). Bitmeden önce serbest.
 */
class TournamentChampionLockTest extends TestCase
{
    use RefreshDatabase;

    private static int $seq = 0;

    private function admin(): User
    {
        $u = User::create([
            'nickname' => 'adm'.(++self::$seq), 'email' => 'adm'.self::$seq.'@e.com',
            'password' => bcrypt('secret123'), 'first_name' => 'A', 'last_name' => 'T', 'country' => 'TR',
        ]);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    private function tournament(string $status): Tournament
    {
        $champ = User::create([
            'nickname' => 'ch'.(++self::$seq), 'email' => 'ch'.self::$seq.'@e.com',
            'password' => bcrypt('secret123'), 'first_name' => 'C', 'last_name' => 'T', 'country' => 'TR',
        ]);

        return Tournament::create([
            'name' => 'T'.self::$seq, 'type' => 'swiss_triple', 'size' => 0, 'status' => $status,
            'players' => [], 'match_length' => 5, 'champion_id' => $champ->id,
        ]);
    }

    public function test_champion_locked_when_finished(): void
    {
        $t = $this->tournament('finished');

        Livewire::actingAs($this->admin())
            ->test(EditTournament::class, ['record' => $t->getRouteKey()])
            ->assertFormFieldIsDisabled('champion_id');
    }

    public function test_champion_editable_before_finish(): void
    {
        $t = $this->tournament('open');

        Livewire::actingAs($this->admin())
            ->test(EditTournament::class, ['record' => $t->getRouteKey()])
            ->assertFormFieldIsEnabled('champion_id');
    }
}
