<?php

namespace Tests\Feature;

use App\Filament\Resources\TournamentResource\Pages\EditTournament;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

// REGRESYON: admin panelde turnuvanın saatini/uzunluğunu değiştirip kaydetmek KATILIMCILARI
// (players JSON) silmemeli. Eski bug: players/bracket düz Textarea -> kaydetmede string'e dönüp
// array-cast'i bozuyor ("saat değişince insanlar atılıyor"). Artık dehydrated(false) ile korunur.
class TournamentEditKeepsPlayersTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::create([
            'nickname' => 'boss', 'email' => 'boss@e.com', 'password' => bcrypt('secret123'),
            'first_name' => 'Boss', 'last_name' => 'T', 'country' => 'TR',
        ]);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    public function test_changing_clock_and_length_keeps_participants(): void
    {
        $admin = $this->admin();
        $players = [
            ['id' => 11, 'name' => 'Ali', 'rating' => 1500, 'avatar' => null],
            ['id' => 12, 'name' => 'Veli', 'rating' => 1600, 'avatar' => null],
            ['id' => 13, 'name' => 'Çağrı', 'rating' => 1700, 'avatar' => null],
        ];
        $t = Tournament::create([
            'name' => 'Test Turnuva', 'type' => 'bracket', 'size' => 8, 'status' => 'open',
            'match_length' => 1, 'prize_coins' => 0, 'players' => $players,
        ]);

        // Admin panelde SAATİ (round_minutes) ve UZUNLUĞU (match_length) değiştirip kaydet.
        Livewire::actingAs($admin)
            ->test(EditTournament::class, ['record' => $t->id])
            ->fillForm(['round_minutes' => 5, 'match_length' => 3])
            ->call('save')
            ->assertHasNoFormErrors();

        $t->refresh();
        // Ayarlar güncellendi...
        $this->assertSame(5, (int) $t->round_minutes);
        $this->assertSame(3, (int) $t->match_length);
        // ...ama KATILIMCILAR AYNEN DURUYOR (atılmadı).
        $this->assertIsArray($t->players);
        $this->assertCount(3, $t->players);
        $this->assertSame([11, 12, 13], array_map(fn ($p) => $p['id'], $t->players));
    }
}
