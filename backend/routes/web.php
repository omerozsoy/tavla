<?php

use App\Http\Controllers\PanelController;
use Illuminate\Support\Facades\Route;

// ---- Yonetim paneli (ayri backend sayfasi, Blade) ----
Route::prefix('panel')->group(function () {
    Route::get('/login', [PanelController::class, 'showLogin']);
    Route::post('/login', [PanelController::class, 'login']);
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
    });
});

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
