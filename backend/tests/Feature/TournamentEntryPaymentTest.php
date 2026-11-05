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
 *  - başarılı kart callback'i oyuncuyu turnuvaya KAYDEDER (kind=tournament_entry)
 *  - TL ile katılan kendiliğinden ayrılamaz (leave 422) — TL iadesi manuel
 *  - kayıt fee_paid=0 coin (çıkış/iptalde coin mint edilmez)
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

    /** PayTR bildirimini GERCEK HMAC ile imzala + /pay/paytr-callback'e POST et. */
    private function paytrNotify(string $oid, string $total)
    {
        config(['paytr.merchant_key' => 'K', 'paytr.merchant_salt' => 'S']);
        $hash = base64_encode(hash_hmac('sha256', $oid.'S'.'success'.$total, 'K', true));

        return $this->post('/pay/paytr-callback', [
            'merchant_oid' => $oid, 'status' => 'success', 'total_amount' => $total, 'hash' => $hash,
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

    public function test_successful_payment_registers_player(): void
    {
        $u = $this->user();
        $t = $this->tlTournament(25000);
        $p = Payment::create([
            'user_id' => $u->id, 'kind' => 'tournament_entry', 'order_id' => 'TT'.$u->id,
            'amount' => 25000, 'tournament_id' => $t->id, 'currency' => '949', 'status' => 'pending',
        ]);

        $this->paytrNotify($p->order_id, '25000')->assertOk();

        $this->assertSame('paid', $p->fresh()->status);
        $players = $t->fresh()->players ?? [];
        $this->assertCount(1, $players);
        $this->assertSame($u->id, $players[0]['id']);
        $this->assertSame(0, (int) $players[0]['fee_paid']); // TL -> coin fee_paid 0 (iade manuel)
    }

    public function test_wrong_amount_does_not_register(): void
    {
        $u = $this->user();
        $t = $this->tlTournament(25000);
        $p = Payment::create([
            'user_id' => $u->id, 'kind' => 'tournament_entry', 'order_id' => 'TT2'.$u->id,
            'amount' => 25000, 'tournament_id' => $t->id, 'currency' => '949', 'status' => 'pending',
        ]);

        $this->paytrNotify($p->order_id, '100')->assertOk(); // uyumsuz (az) tutar

        $this->assertSame('failed', $p->fresh()->status);
        $this->assertCount(0, $t->fresh()->players ?? []);
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
