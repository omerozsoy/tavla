<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-17: /decline satır yokken "kurban->saldırgan" satırı ekliyordu; ardından /send bunu "karşı taraf
// bana yazmıştı" sanıp KABUL ediyordu -> istek kutusu, 5 mesaj sınırı ve kurbanın reddi atlanıyordu.
class MessageConsentBypassTest extends TestCase
{
    use RefreshDatabase;

    private function isOpenFor(User $viewer, User $other): bool
    {
        return DB::table('message_requests')->where('status', 'accepted')
            ->where(fn ($w) => $w
                ->where(fn ($q) => $q->where('requester_id', $viewer->id)->where('target_id', $other->id))
                ->orWhere(fn ($q) => $q->where('requester_id', $other->id)->where('target_id', $viewer->id)))
            ->exists();
    }

    public function test_decline_then_send_does_not_open_conversation(): void
    {
        $attacker = User::factory()->create();
        $victim = User::factory()->create();
        Sanctum::actingAs($attacker);
        $this->postJson("/api/messages/{$victim->id}/decline")->assertOk();
        for ($i = 1; $i <= 5; $i++) {
            $this->postJson("/api/messages/{$victim->id}", ['body' => "m{$i}"])->assertOk();
        }
        $this->postJson("/api/messages/{$victim->id}", ['body' => 'm6'])->assertStatus(403);
        $this->assertFalse($this->isOpenFor($victim, $attacker), 'konuşma kabul edilmiş sayılmamalı');
    }

    public function test_declined_attacker_cannot_reopen_via_fake_row(): void
    {
        $attacker = User::factory()->create();
        $victim = User::factory()->create();
        Sanctum::actingAs($attacker);
        $this->postJson("/api/messages/{$victim->id}", ['body' => 'selam'])->assertOk();
        Sanctum::actingAs($victim);
        $this->postJson("/api/messages/{$attacker->id}/decline")->assertOk();
        Sanctum::actingAs($attacker);
        $this->postJson("/api/messages/{$victim->id}/decline")->assertOk();
        $this->postJson("/api/messages/{$victim->id}", ['body' => 'tekrar'])->assertStatus(403);
    }

    public function test_real_reply_still_accepts_request(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        Sanctum::actingAs($a);
        $this->postJson("/api/messages/{$b->id}", ['body' => 'merhaba'])->assertOk();
        Sanctum::actingAs($b);
        $this->postJson("/api/messages/{$a->id}", ['body' => 'cevap'])->assertOk();
        $this->assertTrue($this->isOpenFor($b, $a));
    }
}
