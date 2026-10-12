<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Support\ChatModeration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Manuel yasak (panel VEYA profil) -> kişi maçtaysa maç sohbetine kırmızı (sys) satır düşer.
// Her iki yol da ChatModeration::announceMuteInActiveMatch'i çağırır; burada ortak mantık test edilir.
class ManualMuteMatchLineTest extends TestCase
{
    use RefreshDatabase;

    public function test_drops_red_sys_line_in_active_match(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create(['nickname' => 'Kufurcu']);
        $room = Room::create([
            'code' => 'MUT01', 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $p1->id, 'p2_user_id' => $p2->id,
            'p1_name' => 'Temiz', 'p2_name' => 'Kufurcu',
            'status' => 'playing', 'mode' => 'ranked', 'version' => 0, 'messages' => [],
        ]);

        ChatModeration::announceMuteInActiveMatch($p2->fresh());

        $room->refresh();
        $msgs = $room->messages;
        $this->assertCount(1, $msgs);
        $last = end($msgs);
        $this->assertSame('sys', $last['slot']);
        $this->assertStringContainsString('Kufurcu', $last['text']);
        $this->assertStringContainsString('yönetici tarafından konuşma yasağı', $last['text']);
    }

    public function test_noop_when_user_not_in_match(): void
    {
        $u = User::factory()->create();
        ChatModeration::announceMuteInActiveMatch($u); // aktif maç yok -> sessiz no-op, hata yok
        $this->assertTrue(true);
    }
}
