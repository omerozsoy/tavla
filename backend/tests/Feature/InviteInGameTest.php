<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// OYUNDAYKEN DAVET GELMEZ: aktif maçta (tek oyun/turnuva/YZ) olan oyuncuya ping() davet
// döndürmez. Davet oluşturulurken müsaitti ama sonra maça girmiş olabilir.
class InviteInGameTest extends TestCase
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

    private function pendingInvite(User $from, User $to, string $code): void
    {
        // Davet CANLI sayılması için davet edenin odası 'waiting' olmalı (ping join'i).
        Room::create(['code' => $code, 'p1_token' => 'inv-'.$code, 'p1_user_id' => $from->id,
            'p1_name' => 'FROM', 'status' => 'waiting', 'mode' => 'friendly', 'version' => 0]);
        DB::table('game_invites')->insert([
            'from_user_id' => $from->id, 'to_user_id' => $to->id, 'room_code' => $code,
            'target' => 1, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_free_player_receives_invite(): void
    {
        $from = $this->user('from');
        $me = $this->user('me');
        $this->pendingInvite($from, $me, 'INVT1');

        Sanctum::actingAs($me);
        $invites = $this->postJson('/api/ping')->assertOk()->json('invites');
        $this->assertCount(1, $invites);
    }

    public function test_in_game_player_gets_no_invite(): void
    {
        $from = $this->user('from');
        $me = $this->user('me');
        $this->pendingInvite($from, $me, 'INVT2');
        // Aktif maç (tek oyun / bot / turnuva hepsi status=playing + p1/p2).
        Room::create(['code' => 'GAME2', 'p1_token' => 'g2', 'p1_user_id' => $me->id,
            'p1_name' => 'ME', 'status' => 'playing', 'mode' => 'ranked', 'version' => 0]);

        Sanctum::actingAs($me);
        $invites = $this->postJson('/api/ping')->assertOk()->json('invites');
        $this->assertCount(0, $invites);
    }

    // TURNUVA MAÇI (dar kapsam): updated_at BAYAT (>5dk) olsa bile turnuva maçındaki oyuncu davet
    // EDİLEMEZ/KABUL EDEMEZ + banner almaz. Kök: turnuva saati cache'te -> rooms.updated_at bayatlayıp
    // 5dk guard'ı düşüyordu. userInTournamentMatch (tourn_room_target cache) pencere olmadan bloklar.
    public function test_stale_tournament_match_player_is_not_invitable(): void
    {
        $from = $this->user('from');
        $me = $this->user('me');
        // Turnuva maçı odası, updated_at 10 DK ÖNCE (bayat) -> normal 5dk guard'ı KAÇIRIR.
        $room = Room::create(['code' => 'TRNM1', 'p1_token' => 't1', 'p1_user_id' => $me->id,
            'p1_name' => 'ME', 'status' => 'playing', 'mode' => '', 'version' => 0]);
        $room->forceFill(['updated_at' => now()->subMinutes(10)])->saveQuietly();
        // Bu odayı TURNUVA maçı yap (RoomController mode türetimiyle aynı anahtar).
        \Illuminate\Support\Facades\Cache::put(
            \App\Http\Controllers\TournamentController::roomTargetKey('TRNM1'), [$me->id, $from->id], now()->addHour()
        );

        // 1) invite(): from -> me reddedilir (turnuva maçında).
        Sanctum::actingAs($from);
        $this->postJson('/api/friends/'.$me->id.'/invite', ['target' => 1])->assertStatus(409);

        // 2) ping(): me bekleyen daveti olsa bile banner almaz.
        $this->pendingInvite($from, $me, 'TRNINV');
        Sanctum::actingAs($me);
        $this->assertCount(0, $this->postJson('/api/ping')->assertOk()->json('invites'));
    }
}
