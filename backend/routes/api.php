<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameController;
use Illuminate\Support\Facades\Route;

// Halka acik
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/nickname-available', [AuthController::class, 'nicknameAvailable']);

// Giris gerektiren
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    Route::get('/game', [GameController::class, 'show']);
    Route::put('/game', [GameController::class, 'save']);
    Route::delete('/game', [GameController::class, 'clear']);
});
