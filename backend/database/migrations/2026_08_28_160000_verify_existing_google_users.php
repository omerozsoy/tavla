<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Geriye donuk duzeltme: Google ile olusturulmus MEVCUT hesaplarin e-postasi
// zaten dogrulanmis olmasina ragmen email_verified_at NULL kalmisti (dogrulama
// yalnizca /auth/google login aninda isaretleniyordu; token'i gecerli kullanici
// yeniden login olmadigi icin profil ekraninda "E-posta adresini dogrula" uyarisi
// takili kaliyordu). Google kullanicisinin guvenilir sinyali: avatar'inin Google
// profil fotografi (googleusercontent.com) olmasi — self-register kullanicilar bu
// domaini asla tasimaz, dolayisiyla yanlis pozitif pratikte imkansiz.
//
// Not: avatarini sonradan degistirmis Google kullanicilari bu backfill'e takilmaz
// ama bir sonraki Google girisinde otomatik dogrulanir (login-ani duzeltmesi canli).
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->whereNull('email_verified_at')
            ->where('avatar', 'like', '%googleusercontent.com%')
            ->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        // Geri alinamaz veri duzeltmesi (dogrulama durumu geri sokulmez).
    }
};
