<?php

namespace Tests\Unit;

use App\Events\RoomUpdated;
use Illuminate\Broadcasting\Channel;
use PHPUnit\Framework\TestCase;

/**
 * GERÇEK-ZAMANLI PUSH SÖZLEŞMESİ (Belirti 1 "geç" kök çözümü — Reverb).
 *
 * Push'un istemciye ulaşması için üç şey SABİT olmalı:
 *  - kanal public `room.{CODE}` (istemci Echo bu ada abone olur: realtime.ts 'room.'+code),
 *  - olay adı `room.updated` (istemci .listen('.room.updated')),
 *  - gövde = poll 'room' yanıtının AYNISI (istemci mevcut sürüm-kapılı apply mantığını değiştirmez).
 * Bu üçü kayarsa push "çalışıyor görünür ama istemciye hiç ulaşmaz". Test sözleşmeyi kilitler.
 */
class RoomUpdatedEventTest extends TestCase
{
    public function test_broadcasts_on_public_room_channel_with_stable_event_name_and_payload(): void
    {
        $payload = ['server_version' => 7, 'foo' => 'bar'];
        $ev = new RoomUpdated('ABCDE', $payload);

        $channels = $ev->broadcastOn();
        $this->assertCount(1, $channels);
        $this->assertInstanceOf(Channel::class, $channels[0]);
        // PUBLIC kanal (private-/presence- öneki YOK) -> broadcasting-auth gerekmez.
        $this->assertSame('room.ABCDE', $channels[0]->name);

        $this->assertSame('room.updated', $ev->broadcastAs());
        $this->assertSame($payload, $ev->broadcastWith());
    }
}
