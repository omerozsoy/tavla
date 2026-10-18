<?php

namespace Tests\Feature;

use App\Filament\Pages\PlayerMessage;
use App\Models\Message;
use App\Models\User;
use App\Support\OfficialMessenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * broadcast(['online'=>true]) YALNIZ çevrimiçi oyunculara gitmeli (last_seen son 2 dk + presence_status
 * offline/ghost DEĞİL — AuthController online panel kriteriyle birebir). Yanlış kitle = spam -> kalkan.
 */
class OfficialMessengerOnlineTest extends TestCase
{
    use RefreshDatabase;

    public function test_online_filter_targets_only_online_users(): void
    {
        $online = User::factory()->create(['last_seen' => now()->subSeconds(30), 'presence_status' => 'available']);
        $playing = User::factory()->create(['last_seen' => now()->subSeconds(10), 'presence_status' => 'playing']);
        $stale = User::factory()->create(['last_seen' => now()->subMinutes(10), 'presence_status' => 'available']);
        $ghost = User::factory()->create(['last_seen' => now(), 'presence_status' => 'ghost']);

        $n = OfficialMessenger::broadcast('merhaba', null, ['online' => true]);

        $this->assertSame(2, $n, 'yalnız 2 çevrimiçi oyuncu alıcı olmalı');
        $this->assertSame(1, Message::where('receiver_id', $online->id)->count());
        $this->assertSame(1, Message::where('receiver_id', $playing->id)->count(), 'offline/ghost dışı statü almalı');
        $this->assertSame(0, Message::where('receiver_id', $stale->id)->count(), 'bayat last_seen almamalı');
        $this->assertSame(0, Message::where('receiver_id', $ghost->id)->count(), 'ghost almamalı');
    }

    public function test_sent_history_groups_a_broadcast_into_one_row_with_recipient_count(): void
    {
        // resmi hesabı kur + 2 kullanıcıya toplu gönder -> geçmişte TEK satır, 2 alıcı.
        OfficialMessenger::account();
        User::factory()->count(2)->create();
        OfficialMessenger::broadcast('duyuru', null);

        $history = (new PlayerMessage)->sentHistory();

        $this->assertCount(1, $history, 'bir broadcast = tek geçmiş satırı');
        $this->assertSame('duyuru', $history->first()->body);
        $this->assertSame(2, (int) $history->first()->recipients);
    }
}
