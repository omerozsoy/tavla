<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use App\Support\OfficialMessenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// "Tavla TV Yönetim" resmi hesabı: panelden tekil/toplu DM. Mesaj oyuncunun NORMAL gelen
// kutusunda (istek kutusunda DEĞİL) görünür; resmi hesap liderlik/aramada gizli.
class OfficialMessengerTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $tag): User
    {
        return User::create([
            'first_name' => $tag, 'last_name' => 'T', 'country' => '',
            'nickname' => $tag.uniqid(), 'email' => uniqid().'@x.com', 'password' => bcrypt('secret123'),
        ]);
    }

    public function test_account_is_system_and_cannot_be_a_normal_login(): void
    {
        $acc = OfficialMessenger::account();
        $this->assertTrue((bool) $acc->is_system);
        $this->assertSame(OfficialMessenger::EMAIL, $acc->email);
        // İkinci çağrı aynı satırı döndürür (tekil).
        $this->assertSame($acc->id, OfficialMessenger::account()->id);
    }

    public function test_direct_message_lands_in_normal_inbox_not_request_box(): void
    {
        $player = $this->makeUser('pl');
        OfficialMessenger::sendTo($player, 'Merhaba, hoş geldin!');

        $acc = OfficialMessenger::account();
        $this->assertSame(1, Message::where('sender_id', $acc->id)->where('receiver_id', $player->id)->count());

        Sanctum::actingAs($player);
        // Oyuncunun konuşma listesinde resmi hesap AÇIK (request=false) görünür.
        $this->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('threads.0.user.id', $acc->id)
            ->assertJsonPath('threads.0.request', false)
            ->assertJsonPath('threads.0.unread', 1);
    }

    public function test_broadcast_sends_to_all_real_users_only(): void
    {
        $a = $this->makeUser('a');
        $b = $this->makeUser('b');
        $c = $this->makeUser('c');

        $n = OfficialMessenger::broadcast('Duyuru: Yeni turnuva!');

        $this->assertSame(3, $n);
        $acc = OfficialMessenger::account();
        foreach ([$a, $b, $c] as $u) {
            $this->assertSame(1, Message::where('sender_id', $acc->id)->where('receiver_id', $u->id)->count());
        }
        // Resmi hesap kendine mesaj almaz.
        $this->assertSame(0, Message::where('receiver_id', $acc->id)->count());
    }

    public function test_official_account_hidden_from_leaderboard(): void
    {
        $player = $this->makeUser('pl');
        OfficialMessenger::account(); // resmi hesabı oluştur

        $ids = collect($this->getJson('/api/leaderboard')->assertOk()->json('players'))->pluck('id');
        $this->assertTrue($ids->contains($player->id));
        $this->assertFalse($ids->contains(OfficialMessenger::account()->id));
    }

    public function test_player_can_reply_without_request_gate(): void
    {
        $player = $this->makeUser('pl');
        OfficialMessenger::sendTo($player, 'Soru sor.');
        $acc = OfficialMessenger::account();

        Sanctum::actingAs($player);
        // Oyuncunun cevabı doğrudan gider (istek/flood kapısına takılmaz).
        $this->postJson("/api/messages/{$acc->id}", ['body' => 'teşekkürler'])
            ->assertOk()
            ->assertJsonPath('message.mine', true);
    }

    public function test_identity_name_collision_is_rejected(): void
    {
        $other = $this->makeUser('taken');
        // Başka kullanıcının takma adı resmi hesaba verilemez.
        $this->assertFalse(OfficialMessenger::updateIdentity($other->nickname, null));
        // Serbest bir ad kabul edilir.
        $this->assertTrue(OfficialMessenger::updateIdentity('Tavla TV Yönetim', null));
        $this->assertSame('Tavla TV Yönetim', OfficialMessenger::name());
    }
}
