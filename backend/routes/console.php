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

// SUNUCU-OTORİTER YEDEK: tamamlanmış online maçlarda istemcisi raporlayamamış (sekme kapandı/
// ağ/başka cihaz) oyuncuların match_results satırını sunucuda tamamla -> maç HER İKİ oyuncunun
// "Maç Analizleri" listesinde çıksın. 2 dk grace (canlı istemcinin zengin satırı önce yazsın).
Schedule::command('matches:backstop-finished')
    ->everyFiveMinutes()
    ->name('backstop-finished-matches')
    ->withoutOverlapping();

// BAYAT "playing" ODA SÜPÜRME: kimsenin poll etmediği (oyuncu+izleyici yok) yarım kalan/terk
// edilmiş online odaları 'finished' işaretle -> "Devam Eden Maç" hayaleti + izleyici DONMASI
// bir gün beklemeden temizlensin. 3 dk grace: canlı maç ~1.5sn'de bir poll eder -> asla değmez.
Schedule::command('matches:reap-stale')
    ->everyFiveMinutes()
    ->name('reap-stale-rooms')
    ->withoutOverlapping();

// BOT MAÇI SAATİNİ İLERLET: bot maçında rakip (bot) HİÇ poll etmez -> tek insan sekmeyi arka
// plana alınca saati soracak kimse kalmaz ve süre bitse de timeout ilan edilmez (donuk "playing").
// Dakikada bir oynanan bot odalarını tick'le -> süre/AFK/terk bittiyse sunucu kendiliğinden
// finalize etsin (insan geri dönmese/sekmeyi kapatsa bile). Süre bitmediğinde idempotent (maliyetsiz).
Schedule::command('matches:tick-bots')
    ->everyMinute()
    ->name('tick-bot-clocks')
    ->withoutOverlapping();

// ÇALIŞAN TÜM SERVİSLERİ izle: dakikada bir kontrol; düşerse OTOMATİK yeniden başlat, kalıcıysa
// admin e-posta + WhatsApp (CallMeBot, ayarlıysa) uyarısı. Validator + gnubg + queue + veritabanı.
// (validator:watch komutu --test için duruyor ama zamanlama buraya birleşti -> çift-uyarı yok.)
Schedule::command('services:watch')
    ->everyMinute()
    ->name('services-watch')
    ->withoutOverlapping();

// CRON NABZI (izleyiciyi izler): schedule:run GERÇEKTEN çalışıyor mu? Her dakika cache'e zaman
// damgası yaz. Admin "Servis Durumu" panelindeki "Zamanlayıcı (cron)" lambası bunu okur; bayatsa
// (>~2.5dk) cron DURMUŞ demektir -> services:watch dahil TÜM izleme/otomatik-restart/alarm sessizce
// ölmüş olur. Bu tek satır o kör noktayı görünür kılar (bugünkü gnubg çökmesinde alarm gelmemesi gibi).
Schedule::call(function () {
    \Illuminate\Support\Facades\Cache::put('ops:cron:heartbeat', time(), now()->addHours(6));
})->everyMinute()->name('ops-cron-heartbeat');
