<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PanelController;
use App\Support\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\PersonalAccessToken;

// Filament SSO: React uygulamasindaki "Yonetici" butonu Sanctum token'i ile buraya
// gelir; token gecerli ve admin ise web oturumu acilir ve Filament paneline yonlenir.
Route::get('/admin/enter', static fn () => response()->json(['message' => 'POST required'], 405)
    ->withHeaders(['Cache-Control' => 'no-store', 'Referrer-Policy' => 'no-referrer']));
Route::post('/admin/enter', function (Request $request) {
    $safeRedirect = static fn (string $path) => redirect($path)->withHeaders([
        'Cache-Control' => 'no-store',
        'Referrer-Policy' => 'no-referrer',
    ]);
    $rawToken = (string) $request->input('token', '');
    $pat = PersonalAccessToken::findToken($rawToken);
    // findToken() yalnız hash eşleşmesini doğrular; normal Sanctum guard gibi expiry de kontrol et.
    if ($pat?->expires_at && $pat->expires_at->isPast()) {
        $pat = null;
    }
    $user = $pat?->tokenable;
    if ($user && $user->is_admin && ! $user->isBanned()) {
        // URL'deki PAT bir kez web oturumuna dönüştürülebilsin; API tokenı silinmez.
        // Cache::add atomik olduğundan aynı URL'nin eşzamanlı tekrarları yalnızca biriyle yarışır.
        if (! Cache::add('admin-sso-used:'.$pat->id, true, now()->addMinutes(5))) {
            return $safeRedirect('/admin/login');
        }
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        return $safeRedirect('/admin');
    }
    return $safeRedirect('/admin/login');
})->middleware('throttle:10,1,admin-sso');

// E-posta dogrulama linki (imzali URL). Dogrular ve SPA'ya yonlendirir.
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware('signed')
    ->name('verification.verify');

// ---- Yonetim paneli (ayri backend sayfasi, Blade) ----
Route::prefix('panel')->group(function () {
    Route::get('/login', [PanelController::class, 'showLogin']);
    Route::post('/login', [PanelController::class, 'login']);
    Route::get('/enter', static fn () => response()->json(['message' => 'POST required'], 405)
        ->withHeaders(['Cache-Control' => 'no-store', 'Referrer-Policy' => 'no-referrer']));
    Route::post('/enter', [PanelController::class, 'enter'])
        ->middleware('throttle:10,1,admin-sso'); // token ile sifresiz giris (siteden)
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
        Route::get('/mail', [PanelController::class, 'mail']);
        Route::post('/mail', [PanelController::class, 'mailTest']);
    });
});

// ---- Odeme (Garanti Sanal POS 3D) ----
Route::get('/pay/card/{payment}', [\App\Http\Controllers\PaymentController::class, 'card'])
    ->name('pay.card')->middleware('signed');
Route::post('/pay/submit/{payment}', [\App\Http\Controllers\PaymentController::class, 'submit'])
    ->name('pay.submit')->middleware('signed') // imzali: baskasinin bekleyen odemesine POST engellenir
    // CSRF muaf: uygulama-ici (SPA) kart formu da bu uca POST edebilsin. Imza (30 dk, odemeye
    // ozel) zaten sahtecilik korumasi saglar; blade formundaki @csrf zararsizca yok sayilir.
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class]);
Route::post('/pay/callback', [\App\Http\Controllers\PaymentController::class, 'callback'])
    ->name('pay.callback')
    ->middleware('throttle:30,1') // forged callback flood'una karsi
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class]);
Route::get('/pay/result', fn () => view('pay.result', ['ok' => false, 'msg' => '']))->name('pay.result');
// Kredi karti arayuzu ONIZLEMESI (gercek tahsilat yok; tasarimi gormek icin).
Route::get('/pay/onizleme', fn () => view('pay.card', [
    'payment' => new \App\Models\Payment(['kind' => 'coins', 'coins' => 5000, 'amount' => 400000, 'currency' => '949']),
    'submitUrl' => '#',
    'preview' => true,
]))->name('pay.preview');

// SPA: API disindaki tum yollar React uygulamasini (public/index.html) servis eder.
// Statik dosyalar (assets/, models/) web sunucusu tarafindan dogrudan sunulur.
// SEO soft-404: BILINMEYEN yollar index.html'i yine servis eder (SPA acilir) ama HTTP 404
// statusuyle -> "her yol 200 doner" (soft 404) sorunu kapanir. Allowlist = src/App.tsx
// applyFromPath() switch'indeki ILK segmentler + hukuki slug'lar. YENI ust-duzey rota
// eklerken buraya da eklenmeli (aksi halde o sayfa 404 doner).
Route::fallback(function (Request $request) {
    $path = trim($request->path(), '/'); // kok icin ''
    $first = $path === '' ? '' : explode('/', $path)[0];

    // /api/* eslesmedi (yanlis uc/yontem) -> HTML degil JSON 404 (soft-404 API'ye sizmasin).
    if ($path === 'api' || str_starts_with($path, 'api/')) {
        return response()->json(['message' => 'Not Found'], 404);
    }

    // Uzantili (dosya-benzeri) istek fallback'e dustuyse gercek dosya yok demektir (var olsa
    // web sunucusu servis ederdi) -> index.html HTML'i DONME, duz 404. (/indexnow.txt, /key.txt,
    // silinmis /assets/*.js chunk istekleri...)
    if ($first !== '' && str_contains(basename($path), '.')) {
        return response('Not Found', 404);
    }

    // Gecerli SPA ilk-segmentleri (src/App.tsx applyFromPath switch'i ile senkron tutulmali).
    static $valid = [
        'online-tavla', 'tavla-oyna',
        'tavla-turnuvasi-organizasyonu', 'kurumsal-tavla-turnuvasi',
        'belediye-tavla-turnuvasi', 'avm-tavla-turnuvasi', 'iletisim',
        'tek-oyun', 'yeni-oyun', 'yz-ile-oyna', 'yapay-zeka', 'arkadasinla-oyna',
        'online-turnuvalar', 'turnuvalar', 'lider-tablosu', 'rutbeler', 'arkadaslar', 'mesajlar',
        'sans-carki', 'zar-slotu', 'bahane-makinesi',
        'turnuva-takvimi', 'kulupler', 'kulup-rehberi', 'haberler', 'blog', 'tavla-magazin',
        'urunler', 'hizmetler', 'nasil-oynanir', 'tavla-rehberi', 'turnuva-kurallari', 'dersler', 'bulmaca',
        'pozisyon-analizi', 'mat-analiz', 'basarimlar', 'hata-gunlugu', 'mac-analizleri',
        'oyun-onizleme', 'cerceve-anim', 'adillik',
        'uyelik', 'magaza', 'pul-tasarimlari', 'siparislerim', 'sepet', 'odeme', 'cerceveler',
        'istatistiklerim', 'profil', 'profil-duzenle', 'ayarlar', 'tahta-ayarlari',
        'giris', 'sifremi-unuttum',
        'bilgi', 'izle',
        'kvkk', 'gizlilik-politikasi', 'cerez-politikasi', 'kullanim-kosullari',
        'uyelik-sozlesmesi', 'sifre-sifirla',
        // backend eslesen rotalar (normalde fallback'e dusmez; guvenlik icin allowlist'te)
        'admin', 'panel', 'pay', 'email',
    ];
    $known = $first === '' || in_array($first, $valid, true);

    $index = public_path('index.html');
    if (file_exists($index)) {
        // Per-route SEO: SPA statik kabugu her rotada AYNI canonical/title/description +
        // <noscript> H1 tasiyordu -> Google ic sayfalari "ana sayfa kopyasi" sayip
        // indekslemiyordu; JS'siz tarayicilar ayni bos kabugu goruyordu. SeoMeta, yola
        // gore bu etiketleri per-route degerlerle degistirir (slug bilinmiyorsa no-op).
        // response()->file yerine string donuyoruz (icerigi degistirdigimiz icin).
        $html = SeoMeta::inject($request->path(), (string) file_get_contents($index));

        // index.html ASLA cache'lenmemeli: her deploy asset hash'lerini degistirir ve
        // eskileri silinir. Tarayici bayat index.html tutarsa silinmis chunk'lara istek
        // atar -> ChunkLoadError -> "sayfa acilmiyor/refresh edilemiyor". Hash'li /assets
        // ise icerik-adresli oldugundan uzun cache'te kalir (web sunucusu/htaccess).
        return response($html, $known ? 200 : 404, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
    return response(
        'Frontend build not found. Build React and copy dist/* into backend/public/.',
        $known ? 200 : 404
    );
});
