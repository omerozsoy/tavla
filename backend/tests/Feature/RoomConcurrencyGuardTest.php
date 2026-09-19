<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// EŞZAMANLILIK KALKANI: bir hesap ŞU AN oynanan (bahisli olsun olmasın) bir maçtayken
// join()/enter() ile ikinci bir odaya katılamaz. "Aynı kullanıcı iki maçta" durumunu ve
// bahisli mm-odasına kodla katılıp escrow'u atlayan para-hilesini kapatır.
class RoomConcurrencyGuardTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n, int $coins = 1000): User
    {
        $u = User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n, 'email' => $n.'@e.com', 'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins;
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    private function playingRoom(User $p1, string $code, int $stake = 0): Room
    {
        return Room::create([
            'code' => $code, 'p1_token' => 'ptok', 'p1_user_id' => $p1->id, 'p1_name' => $p1->nickname,
            'p2_token' => 'p2tok', 'p2_user_id' => null, 'p2_name' => 'X',
            'status' => 'playing', 'stake' => $stake, 'bet_pct' => 0, 'target' => 1, 'version' => 1,
        ]);
    }

    private function waitingRoom(User $p1, string $code): Room
    {
        return Room::create([
            'code' => $code, 'p1_token' => 'host', 'p1_user_id' => $p1->id, 'p1_name' => $p1->nickname,
            'status' => 'waiting', 'stake' => 0, 'bet_pct' => 0, 'version' => 0,
        ]);
    }

    public function test_cannot_join_second_room_while_playing(): void
    {
        $busy = $this->user('busy');
        $this->playingRoom($busy, 'MINE1'); // busy zaten (bahissiz) bir maçta

        $host = $this->user('host1');
        $this->waitingRoom($host, 'OPEN1');

        Sanctum::actingAs($busy);
        $this->postJson('/api/rooms/OPEN1/join', ['token' => 'newtok', 'name' => 'busy'])
            ->assertStatus(409);
    }

    public function test_cannot_enter_second_room_while_playing(): void
    {
        $busy = $this->user('busy2');
        $this->playingRoom($busy, 'MINE2');

        $host = $this->user('host2');
        $this->waitingRoom($host, 'OPEN2');

        Sanctum::actingAs($busy);
        $this->postJson('/api/rooms/OPEN2/enter', ['token' => 'newtok', 'name' => 'busy2'])
            ->assertStatus(409);
    }

    public function test_free_user_can_join_when_not_playing(): void
    {
        $free = $this->user('free');
        $host = $this->user('host3');
        $this->waitingRoom($host, 'OPEN3');

        Sanctum::actingAs($free);
        $this->postJson('/api/rooms/OPEN3/join', ['token' => 'freetok', 'name' => 'free'])
            ->assertOk()
            ->assertJsonPath('slot', 'p2');
    }

    public function test_can_reconnect_to_own_playing_room(): void
    {
        // Kendi oynanan odana yeni bir token'la yeniden bağlanmak BLOKLANMAZ (hedef oda hariç tutulur).
        $me = $this->user('me');
        $room = $this->playingRoom($me, 'MINE3');
        $room->p2_token = null; // p2 boş kalsın ki yeni-katılımcı dalı çalışsın
        $room->save();

        Sanctum::actingAs($me);
        // Farklı token -> slotOf null -> yeni katılımcı dalı; ama userInAnyPlaying kendi odasını
        // (excludeRoomId) atlar -> 409 DEĞİL. (p2 olarak kendi odasına girer.)
        $this->postJson('/api/rooms/MINE3/join', ['token' => 'freshtok', 'name' => 'me'])
            ->assertOk();
    }
}
