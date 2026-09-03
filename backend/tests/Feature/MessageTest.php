<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Arkadaslar arasi ozel mesajlasma (DM): sadece arkadaslar; gelenler okundu; rozet sayisi.
class MessageTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $tag): User
    {
        return User::create([
            'first_name' => $tag, 'last_name' => 'T', 'country' => '',
            'nickname' => $tag.uniqid(), 'email' => uniqid().'@x.com', 'password' => bcrypt('secret123'),
        ]);
    }

    private function befriend(User $a, User $b): void
    {
        DB::table('friendships')->insert([
            'user_id' => $a->id, 'friend_id' => $b->id, 'status' => 'accepted',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_friends_can_message_each_other(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);
        Sanctum::actingAs($me);

        $this->postJson("/api/messages/{$friend->id}", ['body' => 'selam'])
            ->assertOk()
            ->assertJsonPath('message.body', 'selam')
            ->assertJsonPath('message.mine', true);

        $this->assertSame(1, Message::where('sender_id', $me->id)->where('receiver_id', $friend->id)->count());
    }

    public function test_non_friends_cannot_message(): void
    {
        $me = $this->makeUser('me');
        $stranger = $this->makeUser('st');
        Sanctum::actingAs($me);

        $this->postJson("/api/messages/{$stranger->id}", ['body' => 'selam'])->assertStatus(403);
        $this->assertSame(0, Message::count());
    }

    public function test_opening_thread_marks_incoming_read_and_unread_drops(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);

        // Arkadas bana 2 mesaj gonderir
        Sanctum::actingAs($friend);
        $this->postJson("/api/messages/{$me->id}", ['body' => 'a'])->assertOk();
        $this->postJson("/api/messages/{$me->id}", ['body' => 'b'])->assertOk();

        // Ben: 2 okunmamis
        Sanctum::actingAs($me);
        $this->getJson('/api/messages/unread')->assertOk()->assertJsonPath('unread', 2);

        // Konusmayi acinca gelenler okundu
        $this->getJson("/api/messages/{$friend->id}")->assertOk()->assertJsonCount(2, 'messages');
        $this->getJson('/api/messages/unread')->assertOk()->assertJsonPath('unread', 0);
    }

    public function test_threads_list_shows_last_message_and_unread(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);

        Sanctum::actingAs($friend);
        $this->postJson("/api/messages/{$me->id}", ['body' => 'son mesaj'])->assertOk();

        Sanctum::actingAs($me);
        $this->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('threads.0.user.id', $friend->id)
            ->assertJsonPath('threads.0.last.body', 'son mesaj')
            ->assertJsonPath('threads.0.unread', 1);
    }
}
