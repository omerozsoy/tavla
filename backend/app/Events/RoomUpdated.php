<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * GERÇEK-ZAMANLI ODA GÜNCELLEMESİ (polling -> push geçişi, "A" adımı).
 *
 * Bir oyun aksiyonu (hamle/zar/küp/pes/saat-sonu) odayı değiştirince, istemcilerin 1.2sn poll
 * beklemesi yerine ANINDA push edilir. Kanal PUBLIC `room.{code}`: non-bot maçlar zaten herkese
 * açık izlenebilir (show() spectator politikası) -> kanal-yetkisi/`/broadcasting/auth` gerekmez,
 * yeni gizlilik sızıntısı yok (aynı veri poll'da da herkese açıktı). Bot odaları yayınlanmaz
 * (tek-insan; bot hamlesi zaten move yanıtında döner).
 *
 * Payload = show() 'room' yanıtının AYNISI (toClient + clock) -> istemci mevcut poll-uygulama
 * mantığını DEĞİŞTİRMEDEN kullanır (server_version ile idempotent; eski/aynı sürümü yok sayar).
 *
 * ShouldBroadcastNow: yerel (127.0.0.1) Reverb'e anında gönderilir (~10ms); kuyruğa düşüp gnubg
 * işlerinin arkasında beklemez. Çağıran (broadcastRoom) try/catch ile sarar -> Reverb düşse/kapalı
 * olsa bile oyun akışı ASLA bozulmaz (yavaş poll yedeği zaten devreye girer).
 */
class RoomUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public string $code,
        public array $payload,
    ) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new Channel('room.'.$this->code)];
    }

    /** İstemcinin dinlediği olay adı (Echo: .listen('.room.updated', ...)). */
    public function broadcastAs(): string
    {
        return 'room.updated';
    }

    /** Yayınlanan gövde = poll 'room' yanıtı (toClient + clock). */
    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
