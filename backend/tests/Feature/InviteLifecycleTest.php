<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// DAVET YAŞAM DÖNGÜSÜ (E2E oyun akışı denetiminde bulunan açıklar):
//  - Davet eden bekleyen odadan /leave ile ayrılınca oda açık kalıyor, davet kabul edilip sahibi
//    gitmiş odaya giriliyordu (maç başlayınca sahip "terk" ile puan kaybediyordu).
//  - respond() davetin yaşını ve durumunu denetlemiyordu: /ping'de artık görünmeyen (2 dk+) ya da
//    reddedilmiş bir davet sonradan kabul edilebiliyordu.
class InviteLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $tag): User
    {
        return User::create([
            'first_name' => $tag, 'last_name' => 'T', 'country' => '',
            'nickname' => $tag.uniqid(), 'email' => uniqid().'@x.com',
            'password' => bcrypt('secret123'), 'rating' => 1500,
        ]);
    }

    /** Davet + davet edenin bekleyen odası. */
    private function invite(User $from, User $to, string $code, $createdAt = null): int
    {
        Room::create(['code' => $code, 'p1_token' => 'owner-'.$code, 'p1_user_id' => $from->id,
            'p1_name' => 'FROM', 'status' => 'waiting', 'mode' => 'friendly', 'version' => 0]);

        return DB::table('game_invites')->insertGetId([
            'from_user_id' => $from->id, 'to_user_id' => $to->id, 'room_code' => $code,
            'target' => 1, 'status' => 'pending', 'created_at' => $createdAt ?? now(), 'updated_at' => now(),
        ]);
    }

    public function test_owner_leaving_waiting_room_closes_it_and_expires_invite(): void
    {
        $from = $this->user('from');
        $to = $this->user('to');
        $id = $this->invite($from, $to, 'LVWT1');

        Sanctum::actingAs($from);
        $this->postJson('/api/rooms/LVWT1/leave', ['token' => 'owner-LVWT1'])->assertOk();
        $this->assertNull(Room::where('code', 'LVWT1')->first(), 'bekleyen oda kapanmalı');
        $this->assertSame('expired', DB::table('game_invites')->where('id', $id)->value('status'));

        Sanctum::actingAs($to);
        $this->assertCount(0, $this->postJson('/api/ping')->assertOk()->json('invites'));
        $this->postJson("/api/invites/{$id}/respond", ['accept' => true])->assertStatus(409);
    }

    public function test_leave_by_non_owner_token_does_not_close_waiting_room(): void
    {
        $from = $this->user('from');
        $to = $this->user('to');
        $this->invite($from, $to, 'LVWT2');

        Sanctum::actingAs($to);
        $this->postJson('/api/rooms/LVWT2/leave', ['token' => 'baskasi'])->assertStatus(403);
        $this->assertNotNull(Room::where('code', 'LVWT2')->first());
    }

    public function test_invite_older_than_ttl_cannot_be_accepted(): void
    {
        $from = $this->user('from');
        $to = $this->user('to');
        $id = $this->invite($from, $to, 'OLDI1', now()->subMinutes(5));

        Sanctum::actingAs($to);
        $this->assertCount(0, $this->postJson('/api/ping')->assertOk()->json('invites'));
        $this->postJson("/api/invites/{$id}/respond", ['accept' => true])->assertStatus(409);
        $this->assertSame('expired', DB::table('game_invites')->where('id', $id)->value('status'));
    }

    public function test_declined_invite_cannot_be_accepted_later_but_accept_retry_is_idempotent(): void
    {
        $from = $this->user('from');
        $to = $this->user('to');
        $declined = $this->invite($from, $to, 'DECL1');
        $accepted = $this->invite($from, $to, 'ACPT1');

        Sanctum::actingAs($to);
        $this->postJson("/api/invites/{$declined}/respond", ['accept' => false])->assertOk();
        $this->postJson("/api/invites/{$declined}/respond", ['accept' => true])->assertStatus(409);

        $first = $this->postJson("/api/invites/{$accepted}/respond", ['accept' => true])->assertOk();
        $this->assertSame('ACPT1', $first->json('code'));
        $this->postJson("/api/invites/{$accepted}/respond", ['accept' => true])
            ->assertOk()->assertJsonPath('code', 'ACPT1');
    }
}
