<?php

namespace Tests\Feature;

use App\Filament\Pages\SupheliMaclar;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * "Şüpheli Kullanıcılar" panelindeki TURNUVADAN AT aksiyonu. Diskalifiye çekirdeği
 * (TournamentController::adminDisqualify) HTTP + bu panelde ORTAK; burada panel akışı test edilir:
 * açık turnuvada iade + çıkar; $ban=true ile ayrıca hesabı engelle.
 */
class SupheliMaclarKickTest extends TestCase
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

    /** @return array{0:Tournament,1:int} açık turnuva (entry_fee) + hedef oyuncu id */
    private function openTournamentWithPlayer(int $fee = 60): array
    {
        $g = ++self::$seq;
        $u = User::create([
            'nickname' => "sus{$g}", 'email' => "sus{$g}@e.com", 'password' => bcrypt('secret123'),
            'first_name' => 'S', 'last_name' => 'T', 'country' => 'TR', 'rating' => 1600,
        ]);
        $t = Tournament::create([
            'name' => "T{$g}", 'type' => 'bracket', 'size' => 0, 'status' => 'open', 'entry_fee' => $fee,
            'players' => [['id' => $u->id, 'name' => "sus{$g}", 'rating' => 1600, 'premium' => false]],
            'match_length' => 5,
        ]);

        return [$t, $u->id];
    }

    public function test_kick_from_open_tournament_removes_and_refunds(): void
    {
        [$t, $uid] = $this->openTournamentWithPlayer(60);

        Livewire::actingAs($this->admin())
            ->test(SupheliMaclar::class)
            ->call('kickFromTournament', $t->id, $uid, false);

        $ids = collect($t->fresh()->players)->pluck('id')->all();
        $this->assertNotContains($uid, $ids, 'Oyuncu turnuvadan çıkarılmalı');
        $this->assertSame(60, (int) User::find($uid)->coins, 'Açık turnuvada atılınca giriş ücreti iade');
        $this->assertNull(User::find($uid)->banned_at, '$ban=false -> engellenmez');
    }

    public function test_kick_and_ban_sets_banned_at(): void
    {
        [$t, $uid] = $this->openTournamentWithPlayer(60);

        Livewire::actingAs($this->admin())
            ->test(SupheliMaclar::class)
            ->call('kickFromTournament', $t->id, $uid, true);

        $ids = collect($t->fresh()->players)->pluck('id')->all();
        $this->assertNotContains($uid, $ids);
        $this->assertNotNull(User::find($uid)->banned_at, '$ban=true -> hesap engellenmeli');
    }
}
