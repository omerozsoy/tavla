<?php

namespace Tests\Feature;

use App\Filament\Resources\TournamentResource\Pages\ListTournaments;
use App\Models\Tournament;
use App\Models\User;
use App\Support\Swiss\SwissRuntime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Filament paneli "Diskalifiye" tablo aksiyonu. Ortak çekirdek (TournamentModeration) HTTP tarafında
 * da test edildi; burada panel akışı: admin oyuncu seçer -> remove('dq') uygulanır; running+eleme
 * ağacında aksiyon GİZLİ (bracket walkover controller'a özel).
 */
class TournamentResourceDqTest extends TestCase
{
    use RefreshDatabase;

    private static int $seq = 0;

    private function admin(): User
    {
        $u = User::create([
            'nickname' => 'ref'.(++self::$seq), 'email' => 'ref'.self::$seq.'@e.com',
            'password' => bcrypt('secret123'), 'first_name' => 'R', 'last_name' => 'T', 'country' => 'TR',
        ]);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    /** @return array{0:Tournament,1:array<int,int>} turnuva + oyuncu id'leri */
    private function swiss(int $n, string $type = 'swiss_triple'): array
    {
        $g = ++self::$seq;
        $ids = [];
        $players = [];
        for ($i = 1; $i <= $n; $i++) {
            $u = User::create([
                'nickname' => "dq{$g}_$i", 'email' => "dq{$g}_$i@e.com", 'password' => bcrypt('secret123'),
                'first_name' => "P$i", 'last_name' => 'T', 'country' => 'TR', 'rating' => 1500 + $i,
            ]);
            $ids[] = $u->id;
            $players[] = ['id' => $u->id, 'name' => "dq{$g}_$i", 'rating' => 1500 + $i, 'premium' => false];
        }
        $t = Tournament::create([
            'name' => "DQ $n", 'type' => $type, 'size' => 0, 'status' => 'open',
            'players' => $players, 'match_length' => 5,
        ]);

        return [$t, $ids];
    }

    public function test_admin_disqualifies_running_swiss_player_via_panel(): void
    {
        [$t] = $this->swiss(4);
        SwissRuntime::start($t);
        $t->refresh();
        // Bekleyen gerçek maçtan bir oyuncu seç.
        $p1 = null;
        foreach ($t->bracket as $cells) {
            foreach ($cells as $m) {
                if (empty($m['winner']) && ! empty($m['p1']['id']) && ! empty($m['p2']['id'])) {
                    $p1 = (int) $m['p1']['id'];
                    break 2;
                }
            }
        }
        $this->assertNotNull($p1);

        Livewire::actingAs($this->admin())
            ->test(ListTournaments::class)
            ->callTableAction('disqualify', $t->id, data: ['user_id' => $p1])
            ->assertHasNoTableActionErrors();

        $part = collect($t->fresh()->swiss_state['participants'])->firstWhere('id', $p1);
        $this->assertSame('dq', $part['status']);
    }

    public function test_admin_withdraws_running_swiss_player_via_panel(): void
    {
        [$t] = $this->swiss(4);
        SwissRuntime::start($t);
        $t->refresh();
        $p1 = null;
        foreach ($t->bracket as $cells) {
            foreach ($cells as $m) {
                if (empty($m['winner']) && ! empty($m['p1']['id']) && ! empty($m['p2']['id'])) {
                    $p1 = (int) $m['p1']['id'];
                    break 2;
                }
            }
        }
        $this->assertNotNull($p1);

        Livewire::actingAs($this->admin())
            ->test(ListTournaments::class)
            ->callTableAction('withdrawPlayer', $t->id, data: ['user_id' => $p1])
            ->assertHasNoTableActionErrors();

        // Diskalifiyeden farkı: durum 'withdrawn' (ceza değil).
        $part = collect($t->fresh()->swiss_state['participants'])->firstWhere('id', $p1);
        $this->assertSame('withdrawn', $part['status']);
    }

    public function test_admin_corrects_result_double_loss_via_panel(): void
    {
        [$t] = $this->swiss(4);
        SwissRuntime::start($t);
        $t->refresh();
        $key = $a = $b = null;
        foreach ($t->bracket as $cells) {
            foreach ($cells as $m) {
                if (empty($m['winner']) && ! empty($m['p1']['id']) && ! empty($m['p2']['id'])) {
                    $key = $m['key'];
                    $a = (int) $m['p1']['id'];
                    $b = (int) $m['p2']['id'];
                    break 2;
                }
            }
        }
        $this->assertNotNull($key);

        Livewire::actingAs($this->admin())
            ->test(ListTournaments::class)
            ->callTableAction('correctResult', $t->id, data: ['match' => $key, 'outcome' => 'double_loss'])
            ->assertHasNoTableActionErrors();

        $parts = collect($t->fresh()->swiss_state['participants']);
        $this->assertSame(1, (int) $parts->firstWhere('id', $a)['losses']);
        $this->assertSame(1, (int) $parts->firstWhere('id', $b)['losses']);
    }

    public function test_correct_result_action_hidden_when_not_running(): void
    {
        [$t] = $this->swiss(4); // open
        Livewire::actingAs($this->admin())
            ->test(ListTournaments::class)
            ->assertTableActionHidden('correctResult', $t->id);
    }

    public function test_disqualify_action_hidden_for_running_bracket(): void
    {
        [$t] = $this->swiss(4, 'bracket');
        $t->startBracket(); // eleme ağacı başlat (status=running)

        Livewire::actingAs($this->admin())
            ->test(ListTournaments::class)
            ->assertTableActionHidden('disqualify', $t->fresh()->id);
    }

    public function test_disqualify_before_start_removes_player_via_panel(): void
    {
        [$t, $ids] = $this->swiss(4);
        $t->update(['entry_fee' => 60]);
        $target = $ids[1];

        Livewire::actingAs($this->admin())
            ->test(ListTournaments::class)
            ->callTableAction('disqualify', $t->id, data: ['user_id' => $target])
            ->assertHasNoTableActionErrors();

        $ids2 = collect($t->fresh()->players)->pluck('id')->all();
        $this->assertNotContains($target, $ids2);
        $this->assertSame(60, (int) User::find($target)->coins, 'Başlamadan DQ = iade');
    }
}
