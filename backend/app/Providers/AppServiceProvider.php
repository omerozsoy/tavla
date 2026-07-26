<?php

namespace App\Providers;

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
        // Sifre sifirlama linki SPA'ya (kok sayfaya) gitsin
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            $base = rtrim((string) config('app.frontend_url', 'https://tavlai.com'), '/');
            $email = urlencode($notifiable->getEmailForPasswordReset());
            return "{$base}/?action=reset&token={$token}&email={$email}";
        });
    }
}
