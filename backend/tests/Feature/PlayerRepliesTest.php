<?php

namespace Tests\Feature;

use App\Filament\Pages\PlayerReplies;
use App\Models\Message;
use App\Models\User;
use App\Support\OfficialMessenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

// Admin panel "Gelen Cevaplar": resmi hesaba gelen oyuncu cevaplarını okuma + cevaplama.
class PlayerRepliesTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::create([
            'first_name' => 'Ad', 'last_name' => 'Min', 'country' => '',
            'nickname' => 'adm'.substr(md5(microtime()), 0, 5),
            'email' => 'admin'.substr(md5(microtime()), 0, 5).'@e.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(['is_admin' => true])->save();
        config(['services.admin_emails' => [$u->email]]);

        return $u;
    }

    private function player(): User
    {
        return User::create([
            'first_name' => 'Pl', 'last_name' => 'Ayer', 'country' => '',
            'nickname' => 'pl'.substr(md5(microtime()), 0, 5),
            'email' => 'pl'.substr(md5(microtime()), 0, 5).'@e.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    private function playerReplies(User $player, string $body): void
    {
        Message::create([
            'sender_id' => $player->id,
            'receiver_id' => OfficialMessenger::account()->id,
            'body' => $body,
            'created_at' => now(),
        ]);
    }

    public function test_badge_counts_unread_incoming(): void
    {
        $player = $this->player();
        OfficialMessenger::sendTo($player, 'Duyuru');
        $this->playerReplies($player, 'soru 1');
        $this->playerReplies($player, 'soru 2');

        $this->assertSame('2', PlayerReplies::getNavigationBadge());
    }

    public function test_select_marks_incoming_read_and_shows_thread(): void
    {
        $admin = $this->admin();
        $player = $this->player();
        OfficialMessenger::sendTo($player, 'Duyuru');
        $this->playerReplies($player, 'merhaba');
        $official = OfficialMessenger::account();

        $this->actingAs($admin);
        Livewire::test(PlayerReplies::class)
            ->assertOk()
            ->call('select', $player->id)
            ->assertSet('selectedUserId', $player->id);

        // Gelen mesaj okundu işaretlendi -> rozet düşer.
        $this->assertNotNull(
            Message::where('sender_id', $player->id)->where('receiver_id', $official->id)->value('read_at')
        );
        $this->assertNull(PlayerReplies::getNavigationBadge());
    }

    public function test_admin_can_reply_from_panel(): void
    {
        $admin = $this->admin();
        $player = $this->player();
        $this->playerReplies($player, 'bir sorum var');
        $official = OfficialMessenger::account();

        $this->actingAs($admin);
        Livewire::test(PlayerReplies::class)
            ->call('select', $player->id)
            ->set('reply', 'buyrun, dinliyorum')
            ->call('sendReply')
            ->assertSet('reply', '');

        $this->assertSame(1, Message::where('sender_id', $official->id)
            ->where('receiver_id', $player->id)
            ->where('body', 'buyrun, dinliyorum')->count());
    }

    public function test_conversations_only_lists_players_who_replied(): void
    {
        $admin = $this->admin();
        $replier = $this->player();
        $silent = $this->player();
        // İkisine de duyuru gider ama yalnız biri cevap yazar.
        OfficialMessenger::sendTo($replier, 'Duyuru');
        OfficialMessenger::sendTo($silent, 'Duyuru');
        $this->playerReplies($replier, 'geldim');

        $this->actingAs($admin);
        $page = new PlayerReplies;
        $ids = collect($page->conversations())->pluck('id');

        $this->assertTrue($ids->contains($replier->id));
        $this->assertFalse($ids->contains($silent->id));
    }
}
