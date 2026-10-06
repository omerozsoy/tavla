<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-09: turnuvadan çekilme iadesi oyuncunun ÖDEDİĞİ tutarı değil GÜNCEL giriş ücretini ödüyordu.
class TournamentRefundTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true, 'coins' => 0]);
    }

    private function open(User $admin, int $fee): Tournament
    {
        Sanctum::actingAs($admin);
        $id = $this->postJson('/api/tournaments', ['name' => 'T', 'size' => 8, 'premium_only' => false, 'entry_fee' => $fee])
            ->assertSuccessful()->json('tournament.id');

        return Tournament::find($id);
    }

    // Kullanıcı kararı (2026-10-06): turnuvayı açan yönetici OTOMATİK KATILMAZ (koltuk kaplamaz);
    // oynamak isterse normal "Katıl" ile girer.
    public function test_creator_admin_is_not_auto_joined_but_can_join(): void
    {
        $admin = $this->admin();
        $t = $this->open($admin, 0);
        $this->assertSame([], $t->players ?? []);
        $this->postJson("/api/tournaments/{$t->id}/join")->assertSuccessful();
        $this->assertSame([$admin->id], collect($t->fresh()->players)->pluck('id')->all());
    }

    public function test_refund_uses_fee_actually_paid_when_fee_raised_later(): void
    {
        $t = $this->open($this->admin(), 0);
        $p = User::factory()->create(['coins' => 100]);
        Sanctum::actingAs($p);
        $this->postJson("/api/tournaments/{$t->id}/join")->assertSuccessful();
        $t->update(['entry_fee' => 1000]); // yönetici ücreti sonradan yükseltir
        $before = (int) $p->fresh()->coins; // (katılım başarım ödülü verebilir -> farkı ölç)
        $this->postJson("/api/tournaments/{$t->id}/leave")->assertSuccessful();
        $this->assertSame($before, (int) $p->fresh()->coins, 'ödenmemiş ücret iade edilmemeli');
    }

    public function test_refund_returns_full_paid_fee_when_fee_lowered_later(): void
    {
        $t = $this->open($this->admin(), 300);
        $p = User::factory()->create(['coins' => 1000]);
        Sanctum::actingAs($p);
        $this->postJson("/api/tournaments/{$t->id}/join")->assertSuccessful();
        $t->update(['entry_fee' => 50]);
        $before = (int) $p->fresh()->coins;
        $this->postJson("/api/tournaments/{$t->id}/leave")->assertSuccessful();
        $this->assertSame($before + 300, (int) $p->fresh()->coins, 'ödenen ücretin tamamı (300) iade edilmeli');
    }

    public function test_creator_added_for_free_gets_no_refund(): void
    {
        $admin = $this->admin();
        $t = $this->open($admin, 500);
        Sanctum::actingAs($admin);
        $before = (int) $admin->fresh()->coins;
        $this->postJson("/api/tournaments/{$t->id}/leave")->assertSuccessful();
        $this->assertSame($before, (int) $admin->fresh()->coins, 'ücretsiz eklenen oluşturucu iade almamalı');
    }

    // A-22: yönetici bitir/sil -> ödül ödenmediyse ödenen giriş ücretleri iade edilir (eskiden kayboluyordu).
    public function test_admin_finish_open_tournament_refunds_paid_fees_once(): void
    {
        $admin = $this->admin();
        $t = $this->open($admin, 200);
        $p = User::factory()->create(['coins' => 1000]);
        Sanctum::actingAs($p);
        $this->postJson("/api/tournaments/{$t->id}/join")->assertSuccessful();
        $before = (int) $p->fresh()->coins;
        Sanctum::actingAs($admin);
        $this->postJson("/api/tournaments/{$t->id}/finish")->assertSuccessful();
        $this->postJson("/api/tournaments/{$t->id}/finish")->assertSuccessful(); // tekrar: çift iade yok
        $this->assertSame($before + 200, (int) $p->fresh()->coins);
        $this->assertSame(0, (int) $t->fresh()->prize_coins);
    }

    public function test_admin_delete_refunds_paid_fees(): void
    {
        $admin = $this->admin();
        $t = $this->open($admin, 150);
        $p = User::factory()->create(['coins' => 1000]);
        Sanctum::actingAs($p);
        $this->postJson("/api/tournaments/{$t->id}/join")->assertSuccessful();
        $before = (int) $p->fresh()->coins;
        Sanctum::actingAs($admin);
        $this->deleteJson("/api/tournaments/{$t->id}")->assertSuccessful();
        $this->assertSame($before + 150, (int) $p->fresh()->coins);
    }

    public function test_start_uses_fresh_player_list(): void
    {
        $admin = $this->admin();
        $t = $this->open($admin, 0);
        $users = User::factory()->count(2)->create();
        foreach ($users as $u) {
            Sanctum::actingAs($u);
            $this->postJson("/api/tournaments/{$t->id}/join")->assertSuccessful();
        }
        // Yarış: start isteği turnuvayı okuduktan sonra bir oyuncu daha katılır.
        $late = User::factory()->create();
        $raced = false;
        Tournament::retrieved(function (Tournament $x) use (&$raced, $t, $late) {
            if (! $raced && $x->id === $t->id) {
                $raced = true;
                $players = Tournament::find($t->id)->players;
                $players[] = ['id' => $late->id, 'name' => 'Late', 'rating' => 1500, 'fee_paid' => 0];
                \Illuminate\Support\Facades\DB::table('tournaments')->where('id', $t->id)->update(['players' => json_encode($players)]);
            }
        });
        Sanctum::actingAs($admin);
        $this->postJson("/api/tournaments/{$t->id}/start")->assertSuccessful();
        $ids = collect(Tournament::find($t->id)->players)->filter()->pluck('id')->all();
        $this->assertContains($late->id, $ids, 'arada katılan oyuncu ağaçtan düşmemeli');
    }

    public function test_filament_reset_refunds_paid_fees(): void
    {
        $admin = $this->admin();
        $t = $this->open($admin, 120);
        $p = User::factory()->create(['coins' => 1000]);
        Sanctum::actingAs($p);
        $this->postJson("/api/tournaments/{$t->id}/join")->assertSuccessful();
        $before = (int) $p->fresh()->coins;
        \Livewire\Livewire::actingAs($admin)->test(\App\Filament\Resources\TournamentResource\Pages\ListTournaments::class)
            ->callTableAction('resetTournament', $t);
        $this->assertSame($before + 120, (int) $p->fresh()->coins, 'sıfırlamada ödenen ücret iade edilmeli');
        $this->assertSame([], $t->fresh()->players);
    }

    // A-33: katıl/ayrıl döngüsü "oynanan turnuva" sayacını şişirmemeli (başka oyuncununkine de dokunmamalı).
    public function test_join_leave_cycle_does_not_farm_tournaments_played(): void
    {
        $t = $this->open($this->admin(), 0);
        $other = User::factory()->create();
        \App\Models\UserStat::forUser($other->id)->update(['tournaments_played' => 7]);
        $p = User::factory()->create();
        Sanctum::actingAs($p);
        for ($i = 0; $i < 3; $i++) {
            $this->postJson("/api/tournaments/{$t->id}/join")->assertSuccessful();
            $this->postJson("/api/tournaments/{$t->id}/leave")->assertSuccessful();
        }
        $this->assertSame(0, (int) \App\Models\UserStat::forUser($p->id)->fresh()->tournaments_played);
        $this->assertSame(7, (int) \App\Models\UserStat::forUser($other->id)->fresh()->tournaments_played);
    }
}
