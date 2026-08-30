<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * Bir kullaniciya Filament yonetim paneli (/admin) icin sifre verir + admin yapar.
 * Google ile giren kullanicilarin sifresi olmadigi icin panele giremez; bu komut
 * sifre atar (+ is_admin=true, e-posta dogrular). $fillable kisitli oldugundan
 * forceFill sart (bkz filament-user-forcefill).
 *
 * Plesk Artisan kutusunda ("php artisan" onekini kutu ekler):
 *   admin:set-password omerozsoy@gmail.com YeniSifre123
 */
class SetAdminPassword extends Command
{
    protected $signature = 'admin:set-password {email} {password}';

    protected $description = 'Kullaniciya /admin paneli icin sifre verir + admin yapar';

    public function handle(): int
    {
        $email = trim((string) $this->argument('email'));
        $password = (string) $this->argument('password');

        if (strlen($password) < 6) {
            $this->error('Sifre en az 6 karakter olmali.');

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();
        if (! $user) {
            $this->error("Kullanici bulunamadi: {$email}");

            return self::FAILURE;
        }

        $user->forceFill([
            'password' => Hash::make($password),
            'is_admin' => true,
            'email_verified_at' => $user->email_verified_at ?? now(),
            'banned_at' => null,
        ])->save();

        $this->info("OK: {$email} artik admin + sifre atandi. /admin adresinden e-posta+sifre ile gir.");

        return self::SUCCESS;
    }
}
