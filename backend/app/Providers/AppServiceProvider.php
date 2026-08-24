<?php

namespace App\Providers;

use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\DateTimePicker;
use Illuminate\Auth\Notifications\ResetPassword;
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
        // Filament tarih seciciler: Turkce gun.ay.yil formati + takvim (native degil)
        DatePicker::configureUsing(fn (DatePicker $c) => $c->native(false)->displayFormat('d.m.Y')->locale('tr')->firstDayOfWeek(1));
        DateTimePicker::configureUsing(fn (DateTimePicker $c) => $c->native(false)->displayFormat('d.m.Y H:i')->locale('tr')->firstDayOfWeek(1));

        // Sifre sifirlama linki SPA'ya (kok sayfaya) gitsin
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            $base = rtrim((string) config('app.frontend_url', 'https://tavlai.com'), '/');
            $email = urlencode($notifiable->getEmailForPasswordReset());
            return "{$base}/?action=reset&token={$token}&email={$email}";
        });
    }
}
