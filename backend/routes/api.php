<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\RoomController;
use Illuminate\Support\Facades\Route;

// Halka acik
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/google', [AuthController::class, 'googleLogin']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);
Route::get('/nickname-available', [AuthController::class, 'nicknameAvailable']);
Route::get('/leaderboard', [AuthController::class, 'leaderboard']);

// Multiplayer odalari (misafir dostu, token bazli)
Route::post('/matchmaking', [RoomController::class, 'matchmaking']);
Route::post('/matchmaking/cancel', [RoomController::class, 'matchmakingCancel']);
Route::post('/rooms', [RoomController::class, 'create']);
Route::post('/rooms/{code}/join', [RoomController::class, 'join']);
Route::post('/rooms/{code}/chat', [RoomController::class, 'chat']);
Route::get('/rooms/{code}', [RoomController::class, 'show']);
Route::put('/rooms/{code}', [RoomController::class, 'update']);

// Giris gerektiren
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::delete('/account', [AuthController::class, 'deleteAccount']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    Route::post('/rating/report', [AuthController::class, 'reportRating']);

    Route::get('/game', [GameController::class, 'show']);
    Route::put('/game', [GameController::class, 'save']);
    Route::delete('/game', [GameController::class, 'clear']);
});
