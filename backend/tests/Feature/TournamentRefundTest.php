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
}
