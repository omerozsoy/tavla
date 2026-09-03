<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BlunderController;
use App\Http\Controllers\ClubController;
use App\Http\Controllers\ContentController;
use App\Http\Controllers\ErrorJournalController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\PresenceController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\TournamentAdController;
use App\Http\Controllers\TournamentController;
use Illuminate\Support\Facades\Route;

// Halka acik — kimlik dogrulama uclari kaba kuvvete karsi hiz sinirli (IP basi/dk)
// Sifre/token brute-force hedefleri daha siki (10/dk); digerleri 20/dk.
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});
Route::middleware('throttle:20,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/auth/google', [AuthController::class, 'googleLogin']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
});
// Kullanici numaralama (enumeration) yavaslatma: halka acik + hiz sinirli
Route::middleware('throttle:30,1')->get('/nickname-available', [AuthController::class, 'nicknameAvailable']);
Route::get('/leaderboard', [AuthController::class, 'leaderboard']);
Route::get('/achievements', [\App\Http\Controllers\AchievementController::class, 'publicCatalog']); // Bilgi>Rozetler (misafir dahil)
Route::get('/users/{user}/profile', [AuthController::class, 'publicProfile']); // herkese acik profil
Route::get('/contents', [ContentController::class, 'index']); // hizmet/blog/haber/etkinlik/kulup (acik)
Route::get('/menu-config', [\App\Http\Controllers\MenuController::class, 'index']); // sol menu sira/ad/gorunurluk (acik)
Route::get('/tournaments', [TournamentController::class, 'index']);
Route::get('/tournament-ads', [TournamentAdController::class, 'index']); // ana sayfa reklam serisi
Route::get('/ad-slots', [\App\Http\Controllers\AdSlotController::class, 'index']); // paneller arasi reklam seritleri
Route::get('/tournaments/{tournament}', [TournamentController::class, 'show']);
Route::get('/clubs', [ClubController::class, 'index']);
Route::get('/clubs/{club}', [ClubController::class, 'show']);

// Multiplayer odalari (misafir dostu, token bazli).
// Hiz siniri: mesru istemci hamle basina 1 update + ~1200ms'de 1 poll yapar (~<60/dk).
// 240/dk (IP basi) paylasimli NAT'i bile rahat karsilar ama dev-JSON flood'unu (DB/bant
// genisligi tuketimi) durdurur. Sohbet spam'i icin ayrica daha siki 40/dk.
Route::middleware('throttle:240,1')->group(function () {
    Route::post('/matchmaking', [RoomController::class, 'matchmaking']);
    Route::post('/matchmaking/cancel', [RoomController::class, 'matchmakingCancel']);
    Route::get('/live-matches', [RoomController::class, 'liveMatches']); // canli maclar (izleme)
    Route::get('/online-players', [RoomController::class, 'onlinePlayers']); // cevrimici oyuncular
    Route::post('/rooms', [RoomController::class, 'create']);
    Route::post('/rooms/{code}/join', [RoomController::class, 'join']);
    Route::post('/rooms/{code}/enter', [RoomController::class, 'enter']);
    Route::post('/rooms/{code}/settle', [RoomController::class, 'settle']);
    Route::get('/rooms/{code}', [RoomController::class, 'show']);
    Route::put('/rooms/{code}', [RoomController::class, 'update']);
    // Sunucu-otoriter zar + hamle (para maçı güvenliği Faz 2b)
    Route::post('/rooms/{code}/roll', [RoomController::class, 'roll']);
    Route::post('/rooms/{code}/move', [RoomController::class, 'move']);
});
Route::middleware('throttle:40,1')->post('/rooms/{code}/chat', [RoomController::class, 'chat']);

// Giris gerektiren
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::delete('/account', [AuthController::class, 'deleteAccount']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/me/matches', [AuthController::class, 'myMatches']);
    Route::get('/me/matches/{match}/log', [AuthController::class, 'matchLog']); // tam mac analizi
    Route::get('/me/active-rooms', [RoomController::class, 'myActiveRooms']); // devam eden online maclar
    Route::get('/me/analytics', [AuthController::class, 'analytics']);
    Route::get('/me/performance-stats', [AuthController::class, 'performanceStats']); // Medyan Hata Orani + WXP
    Route::get('/me/wxp-breakdown', [AuthController::class, 'wxpBreakdown']); // WXP kategori kirilimi (coin/1/3/5/7)
    Route::get('/me/dice-stats', [AuthController::class, 'diceStats']); // Zar Ortalamalari (zar-basina Sen/Rakip)
    Route::get('/me/match-pr', [AuthController::class, 'matchPr']); // online mac PR cifti (sunucu-otoriter, tutarli gosterim)
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    // reportRating: online macta (room_code) galibiyet/maglubiyet SUNUCU-OTORITER —
    // odanin paylasilan mac skorundan belirlenir, istemci 'won' beyani gecersizse
    // duzeltilir (bkz AuthController::serverResultForRoom). Oda yoksa (pvb) istemciye
    // duser. Suistimal hizini kesmek icin siki throttle; mesru mac dakikalar surer.
    Route::middleware('throttle:12,1')->post('/rating/report', [AuthController::class, 'reportRating']);
    Route::post('/email/resend', [AuthController::class, 'resendVerification']);
    Route::post('/membership/trial', [MembershipController::class, 'startTrial']);
    Route::post('/membership/auto-renew', [MembershipController::class, 'autoRenew']);
    Route::post('/subscribe', [\App\Http\Controllers\PaymentController::class, 'subscribe']);
    Route::post('/shop/coins', [\App\Http\Controllers\PaymentController::class, 'buyCoins']); // sepetteki coin paketleri -> odeme

    Route::get('/friends', [FriendController::class, 'index']);
    Route::post('/friends/request', [FriendController::class, 'request']);
    Route::post('/friends/{userId}/accept', [FriendController::class, 'accept']);
    Route::delete('/friends/{userId}', [FriendController::class, 'destroy']);

    // Arkadaslar arasi ozel mesajlasma (DM)
    Route::get('/messages', [\App\Http\Controllers\MessageController::class, 'threads']);
    Route::get('/messages/unread', [\App\Http\Controllers\MessageController::class, 'unread']);
    Route::get('/messages/{userId}', [\App\Http\Controllers\MessageController::class, 'thread'])->whereNumber('userId');
    Route::post('/messages/{userId}', [\App\Http\Controllers\MessageController::class, 'send'])
        ->whereNumber('userId')->middleware('throttle:30,1'); // spam/flood korumasi
    Route::post('/messages/{userId}/typing', [\App\Http\Controllers\MessageController::class, 'typing'])
        ->whereNumber('userId')->middleware('throttle:60,1'); // "yaziyor…" nabzi

    Route::post('/ping', [PresenceController::class, 'ping']);
    Route::post('/notifications/read', [PresenceController::class, 'readNotifications']);
    Route::post('/notifications/delete', [PresenceController::class, 'deleteNotifications']);
    Route::post('/friends/{userId}/invite', [PresenceController::class, 'invite']);
    Route::post('/invites/{inviteId}/respond', [PresenceController::class, 'respond']);

    Route::get('/me/club', [ClubController::class, 'mine']);
    Route::post('/clubs', [ClubController::class, 'create']);
    Route::post('/clubs/{club}/join', [ClubController::class, 'join']);
    Route::post('/clubs/leave', [ClubController::class, 'leave']);

    Route::post('/tournaments', [TournamentController::class, 'create']);
    Route::post('/tournaments/{tournament}/join', [TournamentController::class, 'join']);
    Route::post('/tournaments/{tournament}/leave', [TournamentController::class, 'leave']);
    Route::post('/tournaments/{tournament}/report', [TournamentController::class, 'report']);
    Route::post('/tournaments/{tournament}/match-room', [TournamentController::class, 'matchRoom']);
    Route::post('/tournaments/{tournament}/start', [TournamentController::class, 'start']);
    Route::post('/tournaments/{tournament}/finish', [TournamentController::class, 'finish']);
    Route::delete('/tournaments/{tournament}', [TournamentController::class, 'destroy']);

    // Yonetim: 'admin' middleware ile route katmaninda korunur (savunma-derinligi;
    // controller'larda da is_admin kontrolu ayrica durur -> biri unutulursa acik kalmaz).
    Route::middleware('admin')->group(function () {
        Route::get('/admin/users', [AdminController::class, 'users']);
        Route::patch('/admin/users/{user}', [AdminController::class, 'updateUser']);
        Route::get('/admin/users/{user}/matches', [AdminController::class, 'userMatches']);
        // Icerik yonetimi (hizmet/blog/haber/etkinlik/kulup)
        Route::get('/admin/contents', [ContentController::class, 'adminIndex']);
        Route::post('/admin/contents', [ContentController::class, 'store']);
        Route::put('/admin/contents/{content}', [ContentController::class, 'update']);
        Route::delete('/admin/contents/{content}', [ContentController::class, 'destroy']);
    });

    Route::get('/shop', [ShopController::class, 'index']);
    Route::post('/shop/buy', [ShopController::class, 'buy']);
    Route::post('/shop/frame', [ShopController::class, 'selectFrame']);
    Route::post('/shop/daily', [ShopController::class, 'daily']);

    Route::get('/blunders', [BlunderController::class, 'index']);
    Route::post('/blunders', [BlunderController::class, 'store']);

    // Hata Gunlugu: gunun/donemin ozeti + kategori kirilimi + son hatalar (decision_analyses'ten).
    Route::get('/me/error-journal', [ErrorJournalController::class, 'index']);

    // Basarimlar (achievements): katalog+progress, sergilenen rozet, gorulmemis unlock'lar.
    Route::get('/me/achievements', [\App\Http\Controllers\AchievementController::class, 'index']);
    Route::post('/me/achievements/featured', [\App\Http\Controllers\AchievementController::class, 'setFeatured']);
    Route::get('/me/achievements/unseen', [\App\Http\Controllers\AchievementController::class, 'unseen']);

    Route::get('/game', [GameController::class, 'show']);
    Route::middleware('throttle:60,1')->put('/game', [GameController::class, 'save']);
    Route::delete('/game', [GameController::class, 'clear']);
});
