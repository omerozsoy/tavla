<?php

use Illuminate\Support\Facades\Route;

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
