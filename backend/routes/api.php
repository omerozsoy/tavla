<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BlunderController;
use App\Http\Controllers\ClubController;
use App\Http\Controllers\ContentController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\PresenceController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\ShopController;
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
Route::get('/nickname-available', [AuthController::class, 'nicknameAvailable']);
Route::get('/leaderboard', [AuthController::class, 'leaderboard']);
Route::get('/users/{user}/profile', [AuthController::class, 'publicProfile']); // herkese acik profil
Route::get('/contents', [ContentController::class, 'index']); // hizmet/blog/haber/etkinlik/kulup (acik)
Route::get('/tournaments', [TournamentController::class, 'index']);
Route::get('/tournaments/{tournament}', [TournamentController::class, 'show']);
Route::get('/clubs', [ClubController::class, 'index']);
Route::get('/clubs/{club}', [ClubController::class, 'show']);

// Multiplayer odalari (misafir dostu, token bazli)
Route::post('/matchmaking', [RoomController::class, 'matchmaking']);
Route::post('/matchmaking/cancel', [RoomController::class, 'matchmakingCancel']);
Route::get('/live-matches', [RoomController::class, 'liveMatches']); // canli maclar (izleme)
Route::post('/rooms', [RoomController::class, 'create']);
Route::post('/rooms/{code}/join', [RoomController::class, 'join']);
Route::post('/rooms/{code}/enter', [RoomController::class, 'enter']);
Route::post('/rooms/{code}/chat', [RoomController::class, 'chat']);
Route::post('/rooms/{code}/settle', [RoomController::class, 'settle']);
Route::get('/rooms/{code}', [RoomController::class, 'show']);
Route::put('/rooms/{code}', [RoomController::class, 'update']);

// Giris gerektiren
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::delete('/account', [AuthController::class, 'deleteAccount']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/me/matches', [AuthController::class, 'myMatches']);
    Route::get('/me/analytics', [AuthController::class, 'analytics']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    Route::post('/rating/report', [AuthController::class, 'reportRating']);
    Route::post('/email/resend', [AuthController::class, 'resendVerification']);
    Route::post('/membership/trial', [MembershipController::class, 'startTrial']);
    Route::post('/subscribe', [\App\Http\Controllers\PaymentController::class, 'subscribe']);

    Route::get('/friends', [FriendController::class, 'index']);
    Route::post('/friends/request', [FriendController::class, 'request']);
    Route::post('/friends/{userId}/accept', [FriendController::class, 'accept']);
    Route::delete('/friends/{userId}', [FriendController::class, 'destroy']);

    Route::post('/ping', [PresenceController::class, 'ping']);
    Route::post('/notifications/read', [PresenceController::class, 'readNotifications']);
    Route::post('/friends/{userId}/invite', [PresenceController::class, 'invite']);
    Route::post('/invites/{inviteId}/respond', [PresenceController::class, 'respond']);

    Route::get('/me/club', [ClubController::class, 'mine']);
    Route::post('/clubs', [ClubController::class, 'create']);
    Route::post('/clubs/{club}/join', [ClubController::class, 'join']);
    Route::post('/clubs/leave', [ClubController::class, 'leave']);

    Route::post('/tournaments', [TournamentController::class, 'create']);
    Route::post('/tournaments/{tournament}/join', [TournamentController::class, 'join']);
    Route::post('/tournaments/{tournament}/report', [TournamentController::class, 'report']);
    Route::post('/tournaments/{tournament}/match-room', [TournamentController::class, 'matchRoom']);
    Route::post('/tournaments/{tournament}/start', [TournamentController::class, 'start']);
    Route::post('/tournaments/{tournament}/finish', [TournamentController::class, 'finish']);
    Route::delete('/tournaments/{tournament}', [TournamentController::class, 'destroy']);

    // Yonetim (admin e-postasi gerektirir; kontrol controller'da)
    Route::get('/admin/users', [AdminController::class, 'users']);
    Route::patch('/admin/users/{user}', [AdminController::class, 'updateUser']);
    Route::get('/admin/users/{user}/matches', [AdminController::class, 'userMatches']);
    // Icerik yonetimi (hizmet/blog/haber/etkinlik/kulup)
    Route::get('/admin/contents', [ContentController::class, 'adminIndex']);
    Route::post('/admin/contents', [ContentController::class, 'store']);
    Route::put('/admin/contents/{content}', [ContentController::class, 'update']);
    Route::delete('/admin/contents/{content}', [ContentController::class, 'destroy']);

    Route::get('/shop', [ShopController::class, 'index']);
    Route::post('/shop/buy', [ShopController::class, 'buy']);
    Route::post('/shop/frame', [ShopController::class, 'selectFrame']);
    Route::post('/shop/daily', [ShopController::class, 'daily']);

    Route::get('/blunders', [BlunderController::class, 'index']);
    Route::post('/blunders', [BlunderController::class, 'store']);

    Route::get('/game', [GameController::class, 'show']);
    Route::put('/game', [GameController::class, 'save']);
    Route::delete('/game', [GameController::class, 'clear']);
});
