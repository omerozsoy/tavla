<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PanelController;
use Illuminate\Support\Facades\Route;

// E-posta dogrulama linki (imzali URL). Dogrular ve SPA'ya yonlendirir.
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware('signed')
    ->name('verification.verify');

// ---- Yonetim paneli (ayri backend sayfasi, Blade) ----
Route::prefix('panel')->group(function () {
    Route::get('/login', [PanelController::class, 'showLogin']);
    Route::post('/login', [PanelController::class, 'login']);
    Route::get('/enter', [PanelController::class, 'enter']); // token ile sifresiz giris (siteden)
    Route::post('/logout', [PanelController::class, 'logout']);

    Route::middleware('admin')->group(function () {
        Route::get('/', fn () => redirect('/panel/users'));
        Route::get('/users', [PanelController::class, 'users']);
        Route::post('/users/{user}', [PanelController::class, 'userUpdate']);
        Route::get('/tournaments', [PanelController::class, 'tournaments']);
        Route::post('/tournaments', [PanelController::class, 'tournamentCreate']);
        Route::post('/tournaments/{tournament}/finish', [PanelController::class, 'tournamentFinish']);
        Route::post('/tournaments/{tournament}/delete', [PanelController::class, 'tournamentDelete']);
        Route::get('/content', [PanelController::class, 'contents']);
        Route::post('/content', [PanelController::class, 'contentSave']);
        Route::post('/content/{content}/delete', [PanelController::class, 'contentDelete']);
        Route::get('/notifications', [PanelController::class, 'notifications']);
        Route::post('/notifications', [PanelController::class, 'notificationSend']);
    });
});

// ---- Odeme (Garanti Sanal POS 3D) ----
Route::get('/pay/card/{payment}', [\App\Http\Controllers\PaymentController::class, 'card'])
    ->name('pay.card')->middleware('signed');
Route::post('/pay/submit/{payment}', [\App\Http\Controllers\PaymentController::class, 'submit'])
    ->name('pay.submit');
Route::post('/pay/callback', [\App\Http\Controllers\PaymentController::class, 'callback'])
    ->name('pay.callback')->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class]);
Route::get('/pay/result', fn () => view('pay.result', ['ok' => false, 'msg' => '']))->name('pay.result');

// SPA: API disindaki tum yollar React uygulamasini (public/index.html) servis eder.
// Statik dosyalar (assets/, models/) web sunucusu tarafindan dogrudan sunulur.
Route::fallback(function () {
    $index = public_path('index.html');
    if (file_exists($index)) {
        return response()->file($index);
    }
    return response(
        'Frontend build not found. Build React and copy dist/* into backend/public/.',
        200
    );
});
