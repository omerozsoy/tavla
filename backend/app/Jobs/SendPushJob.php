<?php

namespace App\Jobs;

use App\Services\PushSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

// Push bildirimini arka planda gonder (DB kuyrugu). Hamle/olay isteginin cevabini bekletmez.
class SendPushJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    /** @param array<string,mixed> $data */
    public function __construct(
        public int $userId,
        public string $title,
        public ?string $body = null,
        public array $data = [],
    ) {}

    public function handle(PushSender $sender): void
    {
        $sender->sendToUser($this->userId, $this->title, $this->body, $this->data);
    }
}
