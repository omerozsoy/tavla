<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Support\RatingPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// ÇEVRİMİÇİ OYUNCULAR play tuşu = PUANLI davet (2026-11-01-b direktifi): istemci unrated=false gönderir
// -> enter() odayı mode='ranked' kurar -> RatingPolicy::isRanked true (rating değişir). Arkadaş listesi /
// Oyun Arayanlar / menü daveti unrated=true gönderir -> mode='friendly' -> puansız (farm guard korunur).
class RankedInviteTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $tag): User
    {
        $u = User::create([
            'first_name' => $tag, 'last_name' => 'T', 'country' => '',
            'nickname' => $tag.uniqid(), 'email' => uniqid().'@x.com',
            'password' => bcrypt('secret123'), 'rating' => 1500,
        ]);
        $u->forceFill(['email_verified_at' => now()])->save(); // email_verified_at fillable DEĞİL

        return $u;
    }

    private function inviteAndEnter(User $from, User $to, bool $unrated): Room
    {
        Sanctum::actingAs($from);
        $code = $this->postJson("/api/friends/{$to->id}/invite", [
            'target' => 5, 'time_control' => 'normal', 'unrated' => $unrated,
        ])->assertOk()->json('code');

        $this->postJson("/api/rooms/{$code}/enter", [
            'token' => 'owner-'.$code, 'name' => 'FROM', 'target' => 5,
        ])->assertOk();

        return Room::where('code', $code)->firstOrFail();
    }

    public function test_ranked_invite_creates_ranked_room(): void
    {
        $from = $this->user('from');
        $to = $this->user('to');
        $room = $this->inviteAndEnter($from, $to, false); // PUANLI davet (play tuşu)

        $this->assertSame('ranked', $room->mode);
        $this->assertFalse((bool) $room->unrated);
        $this->assertTrue(RatingPolicy::isRanked($room, $from->id, $to->id), 'puanlı davet maçı puanlı olmalı');
    }

    public function test_unrated_invite_stays_friendly_and_unrated(): void
    {
        $from = $this->user('from');
        $to = $this->user('to');
        $room = $this->inviteAndEnter($from, $to, true); // puansız arkadaş daveti

        $this->assertSame('friendly', $room->mode);
        $this->assertTrue((bool) $room->unrated);
        $this->assertFalse(RatingPolicy::isRanked($room, $from->id, $to->id), 'arkadaş daveti puansız kalmalı');
    }

    // REGRESYON: puanlı davet odası mode='ranked' -> RoomAccess::requiresAccount true; davetli YENİ
    // katılımcı olarak enter() edince eskiden "eşleşme akışını kullan" 403'üne takılıyordu. Geçerli
    // davetlisi guard'ı atlamalı, p2 koltuğuna oturmalı.
    public function test_invitee_can_join_ranked_invite_room(): void
    {
        $from = $this->user('from');
        $to = $this->user('to');

        Sanctum::actingAs($from);
        $code = $this->postJson("/api/friends/{$to->id}/invite", [
            'target' => 5, 'time_control' => 'normal', 'unrated' => false,
        ])->assertOk()->json('code');
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p1-'.$code, 'name' => 'FROM', 'target' => 5])->assertOk();

        $inviteId = DB::table('game_invites')->where('room_code', $code)->value('id');

        Sanctum::actingAs($to);
        $this->postJson("/api/invites/{$inviteId}/respond", ['accept' => true])->assertOk();
        // ESKIDEN BURADA 403: davetli ranked odaya katilamiyordu.
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p2-'.$code, 'name' => 'TO', 'target' => 5])->assertOk();

        $room = Room::where('code', $code)->firstOrFail();
        $this->assertSame('ranked', $room->mode);
        $this->assertSame($to->id, (int) $room->p2_user_id, 'davetli p2 koltuğuna oturmalı');
    }
}
