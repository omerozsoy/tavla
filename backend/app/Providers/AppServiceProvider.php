<?php

namespace App\Providers;

use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\DateTimePicker;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Marka adi .env'den gelir (APP_NAME=TavlaTv). E-posta basligi/altbilgisi
        // config('app.name') kullanir; ayrica e-posta govdeleri asagida Turkcelestirildi.

        // Filament tarih seciciler: Turkce gun.ay.yil formati + takvim (native degil)
        DatePicker::configureUsing(fn (DatePicker $c) => $c->native(false)->displayFormat('d.m.Y')->locale('tr')->firstDayOfWeek(1));
        DateTimePicker::configureUsing(fn (DateTimePicker $c) => $c->native(false)->displayFormat('d.m.Y H:i')->locale('tr')->firstDayOfWeek(1));

        // Sifre sifirlama linki SPA'ya (kok sayfaya) gitsin
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            $base = rtrim((string) config('app.frontend_url', 'https://tavlai.com'), '/');
            $email = urlencode($notifiable->getEmailForPasswordReset());
            return "{$base}/?action=reset&token={$token}&email={$email}";
        });

        // E-posta dogrulama e-postasi: markali HTML sablon (logo + terracotta)
        VerifyEmail::toMailUsing(function ($notifiable, string $url) {
            return (new MailMessage)
                ->subject('TavlaTV — E-posta Adresini Doğrula')
                ->view('emails.message', [
                    'heading' => 'Merhaba!',
                    'intro' => 'TavlaTV hesabını etkinleştirmek için e-posta adresini doğrula. Aşağıdaki butona tıkla.',
                    'buttonText' => 'E-posta Adresini Doğrula',
                    'url' => $url,
                    'outro' => 'Bir hesap oluşturmadıysan bu e-postayı yok sayabilirsin.',
                ]);
        });

        // Sifre sifirlama e-postasi: markali HTML sablon
        ResetPassword::toMailUsing(function ($notifiable, string $token) {
            $base = rtrim((string) config('app.frontend_url', 'https://tavlai.com'), '/');
            $email = urlencode($notifiable->getEmailForPasswordReset());
            $url = "{$base}/?action=reset&token={$token}&email={$email}";

            return (new MailMessage)
                ->subject('TavlaTV — Şifre Sıfırlama')
                ->view('emails.message', [
                    'heading' => 'Merhaba!',
                    'intro' => 'TavlaTV hesabın için şifre sıfırlama isteği aldık. Aşağıdaki butona tıklayarak yeni şifreni belirle.',
                    'buttonText' => 'Şifreyi Sıfırla',
                    'url' => $url,
                    'outro' => 'Bu bağlantı bir süre sonra geçersiz olur. Bu isteği sen yapmadıysan herhangi bir şey yapmana gerek yok.',
                ]);
        });
    }
}
