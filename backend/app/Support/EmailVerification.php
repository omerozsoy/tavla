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
        // Çoklu-domain: imzalı link ZİYARET EDİLEN marka domaininde üretilir (aynı backend her iki
        // host'a hizmet eder; 'signed' middleware tıklanan host'a göre doğrular). Dil de markaya göre.
        $brand = Brand::current();
        $origin = (string) ($brand['origin'] ?? '');
        if ($origin !== '') {
            URL::forceRootUrl($origin);
        }
        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes((int) config('auth.verification.expire', 60)),
            ['id' => $user->getKey(), 'hash' => sha1($user->getEmailForVerification())],
        );

        $en = ($brand['locale'] ?? 'tr') === 'en';
        $name = (string) ($brand['name'] ?? 'TavlaTV');
        $payload = $en ? [
            'heading' => 'Hello!',
            'intro' => "Enter the 6-digit code below on the site to verify your {$name} account — or click the button.",
            'code' => $code,
            'url' => $url,
            'buttonText' => 'Verify Email Address',
            'outro' => 'The code is valid for 15 minutes. If you did not create an account, you can ignore this email.',
        ] : [
            'heading' => 'Merhaba!',
            'intro' => "{$name} hesabını doğrulamak için aşağıdaki 6 haneli kodu siteye gir — veya butona tıkla.",
            'code' => $code,
            'url' => $url,
            'buttonText' => 'E-posta Adresini Doğrula',
            'outro' => 'Kod 15 dakika geçerlidir. Bir hesap oluşturmadıysan bu e-postayı yok sayabilirsin.',
        ];
        $subject = $en ? "{$name} — Email Verification" : "{$name} — E-posta Doğrulama";
        $payload['brand'] = $brand; // şablon logo/dil/footer'ı markaya göre çizsin
        Mail::send('emails.message', $payload, fn ($m) => $m->to($user->email)->subject($subject));
    }
}
