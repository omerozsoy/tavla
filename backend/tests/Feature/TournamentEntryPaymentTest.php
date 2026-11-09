<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Tournament;
use App\Models\User;
use App\Support\TournamentModeration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * TL'li turnuva (tournaments.entry_fee_try KURUS) katılım ödemesi:
 *  - join() doğrudan katılımı reddeder (tl_payment_required) — ödeme atlanamaz
 *  - tournamentEntry() PENDING ödeme kurar (kart PayTR'siz, card=true), oyuncuyu HENÜZ kaydetmez
 *  - TL ile katılan kendiliğinden ayrılamaz (leave 422) — TL iadesi manuel
 */
class TournamentEntryPaymentTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::factory()->create(['plan' => 'free']);
    }

    private function tlTournament(int $kurus = 25000): Tournament
    {
        return Tournament::create([
            'name' => 'TL Kupa', 'size' => 8, 'status' => 'open', 'players' => [],
            'entry_fee' => 0, 'entry_fee_try' => $kurus, 'premium_only' => false, 'active' => true,
        ]);
    }

    public function test_join_rejects_tl_tournament_without_payment(): void
    {
        $t = $this->tlTournament();
        Sanctum::actingAs($this->user());

        $this->postJson("/api/tournaments/{$t->id}/join")
            ->assertStatus(422)->assertJsonPath('code', 'tl_payment_required');
        $this->assertCount(0, $t->fresh()->players ?? []);
    }

    public function test_entry_creates_pending_payment_without_registering(): void
    {
        $u = $this->user();
        $t = $this->tlTournament(25000);
        Sanctum::actingAs($u);

        // Kart PayTR'siz: card=true + payment_id doner; PENDING ödeme kurulur, oyuncu HENÜZ kaydedilmez.
        $res = $this->postJson("/api/tournaments/{$t->id}/pay")
            ->assertOk()->assertJson(['card' => true]);
        $this->assertNull($res->json('url'));

        $p = Payment::where('user_id', $u->id)->where('kind', 'tournament_entry')->first();
        $this->assertNotNull($p);
        $this->assertSame('pending', $p->status);
        $this->assertSame(25000, (int) $p->amount);
        $this->assertCount(0, $t->fresh()->players ?? []); // fulfillment admin onayinda
    }

    public function test_tl_player_cannot_self_leave(): void
    {
        $u = $this->user();
        $t = $this->tlTournament();
        TournamentModeration::register($t, $u, 0); // ödeme sonrası kayıtlı kabul
        Sanctum::actingAs($u);

        $this->postJson("/api/tournaments/{$t->id}/leave")->assertStatus(422);
        $this->assertCount(1, $t->fresh()->players ?? []); // hâlâ kayıtlı
    }
}
