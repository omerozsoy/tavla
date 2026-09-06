<?php

use App\Models\Room;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Bayat oda/davet temizligi: RoomController'daki firsatci cleanupStale() yalnizca
// trafik oldukca calisir; bu zamanlanmis is trafik olmasa da birikimi onler.
// NOT: Sunucuda "* * * * * php artisan schedule:run" cron'u (Plesk Zamanlanmis Gorevler)
// tanimli OLMALI; yoksa bu is calismaz (firsatci temizlik yine de devam eder).
Schedule::call(function () {
    Room::where('status', 'mm_waiting')
        ->whereNull('p2_token')
        ->where('created_at', '<', now()->subMinutes(2))
        ->delete();
    Room::where('updated_at', '<', now()->subDay())->delete();
    DB::table('game_invites')->where('created_at', '<', now()->subMinutes(10))->delete();
})->everyFiveMinutes()->name('cleanup-stale-rooms')->withoutOverlapping();

// Maç kaydı budama: yüksek hacimli pvb (bota karşı) kayıtları game_logs tablosunu
// şişirmesin -> 90 günden eski pvb maçlarını her gün sil. Online/yerel maçlar korunur.
Schedule::command('gamelogs:prune --days=90')
    ->daily()
    ->name('prune-game-logs')
    ->withoutOverlapping();

// ÇALIŞAN TÜM SERVİSLERİ izle: dakikada bir kontrol; düşerse OTOMATİK yeniden başlat, kalıcıysa
// admin e-posta + WhatsApp (CallMeBot, ayarlıysa) uyarısı. Validator + gnubg + queue + veritabanı.
// (validator:watch komutu --test için duruyor ama zamanlama buraya birleşti -> çift-uyarı yok.)
Schedule::command('services:watch')
    ->everyMinute()
    ->name('services-watch')
    ->withoutOverlapping();
