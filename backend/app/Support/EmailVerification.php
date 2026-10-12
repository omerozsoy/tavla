<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

/**
 * E-posta doğrulama maili (6 haneli kod + imzalı link) gönderimi — TEK kaynak.
 * AuthController::register/resend ve Filament toplu aksiyonu buradan çağırır (kopya mantık yok).
 */
class EmailVerification
{
    public static function send(User $user): void
    {
        $code = (string) random_int(100000, 999999);
        Cache::put(
            'eotp:'.$user->id,
            ['code' => $code, 'tries' => 0, 'email' => strtolower((string) $user->email)],
            now()->addMinutes(15),
        );
        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes((int) config('auth.verification.expire', 60)),
            ['id' => $user->getKey(), 'hash' => sha1($user->getEmailForVerification())],
        );
        Mail::send('emails.message', [
            'heading' => 'Merhaba!',
            'intro' => 'TavlaTV hesabını doğrulamak için aşağıdaki 6 haneli kodu siteye gir — veya butona tıkla.',
            'code' => $code,
            'url' => $url,
            'buttonText' => 'E-posta Adresini Doğrula',
            'outro' => 'Kod 15 dakika geçerlidir. Bir hesap oluşturmadıysan bu e-postayı yok sayabilirsin.',
        ], fn ($m) => $m->to($user->email)->subject('TavlaTV — E-posta Doğrulama'));
    }
}
