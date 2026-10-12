<?php

namespace App\Jobs;

use App\Models\User;
use App\Support\EmailVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

// E-posta doğrulama mailini arka planda (DB kuyruğu) gönder. Toplu gönderimde admin isteğini
// bekletmez/timeout etmez; her mail ayrı job -> biri hata verse diğerleri etkilenmez.
class SendVerificationEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(public int $userId) {}

    public function handle(): void
    {
        $user = User::find($this->userId);
        // Job kuyrukta beklerken doğrulanmış/silinmiş olabilir -> tekrar kontrol et (gereksiz mail yok).
        if (! $user || $user->email_verified_at !== null || empty($user->email)) {
            return;
        }
        EmailVerification::send($user);
    }
}
