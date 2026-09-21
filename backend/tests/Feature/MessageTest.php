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

    public function test_non_friend_message_goes_to_request_box_with_flood_limit(): void
    {
        // DM artik herkese acik: arkadas-olmayana ilk mesaj ISTEK kutusuna duser (200);
        // onaylanana kadar en fazla 5 mesaj (flood korumasi), 6.'si 403.
        $me = $this->makeUser('me');
        $stranger = $this->makeUser('st');
        Sanctum::actingAs($me);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson("/api/messages/{$stranger->id}", ['body' => "selam {$i}"])->assertOk();
        }
        // 6. mesaj: onaylanmamis istekte flood siniri
        $this->postJson("/api/messages/{$stranger->id}", ['body' => 'selam 6'])->assertStatus(403);

        $this->assertSame(5, Message::count());
        $this->assertSame(1, DB::table('message_requests')
            ->where('requester_id', $me->id)->where('target_id', $stranger->id)
            ->where('status', 'pending')->count());
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

    public function test_read_receipt_flips_after_receiver_opens_thread(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);

        // Ben mesaj gonderirim -> henuz okunmadi (read=false)
        Sanctum::actingAs($me);
        $this->postJson("/api/messages/{$friend->id}", ['body' => 'okundu mu?'])
            ->assertOk()->assertJsonPath('message.read', false);
        $this->getJson("/api/messages/{$friend->id}")->assertJsonPath('messages.0.read', false);

        // Arkadas konusmayi acar -> mesajim okundu isaretlenir
        Sanctum::actingAs($friend);
        $this->getJson("/api/messages/{$me->id}")->assertOk();

        // Ben tekrar bakinca mesajim read=true (mavi tik)
        Sanctum::actingAs($me);
        $this->getJson("/api/messages/{$friend->id}")->assertJsonPath('messages.0.read', true);
    }

    public function test_typing_flag_visible_to_partner_thread(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);

        // Arkadas yaziyor nabzi birakir
        Sanctum::actingAs($friend);
        $this->postJson("/api/messages/{$me->id}/typing")->assertOk();

        // Ben konusmayi acinca typing=true gorunur
        Sanctum::actingAs($me);
        $this->getJson("/api/messages/{$friend->id}")->assertOk()->assertJsonPath('typing', true);
    }

    public function test_typing_to_stranger_is_silently_ignored(): void
    {
        // Alakasiz kisiye typing nabzi: 403 DEGIL, sessiz gec (200 + ok:false).
        $me = $this->makeUser('me');
        $stranger = $this->makeUser('st');
        Sanctum::actingAs($me);

        $this->postJson("/api/messages/{$stranger->id}/typing")
            ->assertOk()->assertJsonPath('ok', false);
    }

    // 1x1 seffaf PNG data-URL (gecerli gorsel).
    private const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    public function test_friend_can_send_image_with_text_and_thread_returns_it(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);
        Sanctum::actingAs($me);

        $this->postJson("/api/messages/{$friend->id}", ['body' => 'bak', 'image' => self::IMG])
            ->assertOk()
            ->assertJsonPath('message.body', 'bak')
            ->assertJsonPath('message.image', self::IMG);

        // Konusma listesinde gorsel doner.
        $this->getJson("/api/messages/{$friend->id}")
            ->assertOk()
            ->assertJsonPath('messages.0.image', self::IMG);

        // Gelen kutusu onizlemesi: has_image=true (agir base64 GONDERILMEZ).
        Sanctum::actingAs($friend);
        $this->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('threads.0.last.has_image', true);
    }

    public function test_image_only_message_allowed_empty_body(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);
        Sanctum::actingAs($me);

        $this->postJson("/api/messages/{$friend->id}", ['body' => '', 'image' => self::IMG])
            ->assertOk()
            ->assertJsonPath('message.image', self::IMG);
        $this->assertSame(1, Message::count());
    }

    public function test_empty_body_and_no_image_rejected(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);
        Sanctum::actingAs($me);

        $this->postJson("/api/messages/{$friend->id}", ['body' => '   '])->assertStatus(422);
        $this->assertSame(0, Message::count());
    }

    public function test_non_image_data_url_rejected(): void
    {
        $me = $this->makeUser('me');
        $friend = $this->makeUser('fr');
        $this->befriend($me, $friend);
        Sanctum::actingAs($me);

        // starts_with:data:image/ -> pdf/script data-URL reddedilir.
        $this->postJson("/api/messages/{$friend->id}", ['body' => 'x', 'image' => 'data:text/html,<script>'])
            ->assertStatus(422);
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
