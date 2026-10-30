<?php

use App\Http\Controllers\AchievementController;
use App\Http\Controllers\AddressController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdSlotController;
use App\Http\Controllers\AnalysisController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BlunderController;
use App\Http\Controllers\BugReportController;
use App\Http\Controllers\ClubController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\ContentCommentController;
use App\Http\Controllers\ContentController;
use App\Http\Controllers\CookieController;
use App\Http\Controllers\DiceSlotController;
use App\Http\Controllers\EntryPopupController;
use App\Http\Controllers\ErrorJournalController;
use App\Http\Controllers\FooterController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\GameLogController;
use App\Http\Controllers\InfoPageController;
use App\Http\Controllers\LegalPageController;
use App\Http\Controllers\LuckyWheelAdminController;
use App\Http\Controllers\LuckyWheelController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PresenceController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PushController;
use App\Http\Controllers\RankDivisionController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\SiteTagController;
use App\Http\Controllers\TournamentAdController;
use App\Http\Controllers\TournamentController;
use App\Http\Middleware\EnsureActiveAccount;
use App\Http\Middleware\EnsureEmailVerified;
use App\Http\Middleware\EnsurePremium;
use Illuminate\Support\Facades\Route;

// Halka acik — kimlik dogrulama uclari kaba kuvvete karsi hiz sinirli (IP basi/dk)
// Sifre/token brute-force hedefleri daha siki (10/dk); digerleri 20/dk.
Route::middleware('throttle:10,1,auth-login')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});
Route::middleware('throttle:20,1,auth-register')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/auth/google', [AuthController::class, 'googleLogin']);
    Route::post('/auth/google/code', [AuthController::class, 'googleCode']); // Android sistem-tarayıcı OAuth code akışı
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
});
// Kullanici numaralama (enumeration) yavaslatma: halka acik + hiz sinirli
Route::middleware('throttle:10,1,nickname')->get('/nickname-available', [AuthController::class, 'nicknameAvailable']);
// GEÇİCİ TANI (reload beacon): "maç içinde F5" şikayetinin nedenini topla. Halka açık (beacon
// token taşımaz), hız sınırlı, best-effort (hata yutulur). reload_events tablosu yoksa no-op.
Route::post('/diag/reload', function (\Illuminate\Http\Request $r) {
    try {
        if (! \Illuminate\Support\Facades\Schema::hasTable('reload_events')) {
            return response()->json(['ok' => false]);
        }
        \Illuminate\Support\Facades\DB::table('reload_events')->insert([
            'reason' => mb_substr((string) $r->input('reason', ''), 0, 40),
            'in_match' => $r->boolean('in_match'),
            'is_mobile' => $r->boolean('is_mobile'),
            'nav_type' => mb_substr((string) $r->input('nav_type', ''), 0, 20),
            'path' => mb_substr((string) $r->input('path', ''), 0, 160),
            'user_id' => optional($r->user('sanctum'))->id,
            'created_at' => now(),
        ]);
    } catch (\Throwable $e) {
        // best-effort: tanı yazımı asla istek/akışı bozmasın
    }

    return response()->json(['ok' => true]);
})->middleware('throttle:120,1,diag-reload');
// GEÇİCİ TANI (push beacon): native app'te FCM token'ı neden kaydolmuyor — push.ts her karar
// noktasında buraya yazar (hasCap/izin/registration/hata). Yalnız WebView app'ten çağrılır.
// Log'a yazar (migration yok), best-effort. Çözülünce bu route + push.ts beacon'ları silinir.
Route::post('/diag/push', function (\Illuminate\Http\Request $r) {
    try {
        // Ayri debug dosyasi (Log::build anlik kanal): 'single' kanali 'error' seviyesinde
        // oldugundan info/debug eleniyordu; bu kanal kendi debug seviyesinde yazar, ana log'u
        // kirletmez, alarm tetiklemez. storage/logs/push-diag.log.
        \Illuminate\Support\Facades\Log::build([
            'driver' => 'single',
            'path' => storage_path('logs/push-diag.log'),
            'level' => 'debug',
        ])->debug('push-diag', [
            'uid' => optional($r->user('sanctum'))->id,
            'ev' => mb_substr((string) $r->input('ev', ''), 0, 24),
            'd' => array_map(fn ($v) => is_scalar($v) ? mb_substr((string) $v, 0, 60) : null, (array) $r->input('d', [])),
            'ua' => mb_substr((string) $r->userAgent(), 0, 160),
        ]);
    } catch (\Throwable $e) {
        // best-effort
    }

    return response()->json(['ok' => true]);
})->middleware('throttle:240,1,diag-push');
Route::get('/leaderboard', [AuthController::class, 'leaderboard']);
Route::get('/leaderboard/pr', [AuthController::class, 'prLeaderboard']); // PR Sıralaması (Career PR)
Route::get('/leaderboard/search', [AuthController::class, 'leaderboardSearch']); // isme göre ara (ilk 100'de olmayanlar)
Route::get('/top-ranks', [AuthController::class, 'topRanks']); // site geneli top-3 rozet haritası (PR madalya + Rating kupa)
Route::get('/roles', [AuthController::class, 'roles']); // site geneli rol haritası (yönetici + destek id'leri -> isim yanı kalkan)
Route::get('/achievements', [AchievementController::class, 'publicCatalog']); // Bilgi>Rozetler (misafir dahil)
Route::get('/users/{user}/profile', [AuthController::class, 'publicProfile']); // herkese acik profil
Route::get('/contents', [ContentController::class, 'index']); // hizmet/blog/haber/etkinlik/kulup (acik)
Route::post('/contents/{content}/view', [ContentController::class, 'view'])->middleware('throttle:10,1,content-view'); // makale/haber okunma sayaci +1 (acik)
Route::get('/contents/{content}/comments', [ContentCommentController::class, 'index']); // haber ONAYLI yorumlari (acik)
Route::get('/info-pages', [InfoPageController::class, 'index']); // /bilgi/<slug> sekmeleri (acik)
Route::get('/menu-config', [MenuController::class, 'index']); // sol menu sira/ad/gorunurluk (acik)
Route::get('/footer-config', [FooterController::class, 'index']); // footer kolon sira/baslik/gorunurluk (acik)
Route::get('/site-tags', [SiteTagController::class, 'index']); // Google Etiketi (gtag) yapilandirmasi (acik)
Route::get('/realtime-config', [RoomController::class, 'realtimeConfig']); // Reverb WS push: enabled + public app key (acik; secret DONMEZ)
Route::get('/board-designs', [ShopController::class, 'designs']); // admin Tavla Tasarımı: grup/fiyat/özel tahtalar (acik)
Route::get('/rank-divisions', [RankDivisionController::class, 'index']); // rutbe rating esikleri (acik)
Route::middleware('throttle:120,1,tourn-read')->get('/tournaments', [TournamentController::class, 'index']); // acik poll (istemci 8-15sn) + autoStartDue bakim yazmasi -> IP basi 2/sn sinir
Route::get('/tournament-ads', [TournamentAdController::class, 'index']); // ana sayfa reklam serisi
Route::get('/ad-slots', [AdSlotController::class, 'index']); // paneller arasi reklam seritleri
Route::middleware('throttle:30,1,ad-click')->post('/ad-slots/{ad}/click', [AdSlotController::class, 'click']); // "saka reklami" tiklamasi (opsiyonel auth)
Route::get('/ad-slots/{ad}/clickers', [AdSlotController::class, 'clickers']); // tiklayanlarin adlari (modal icinde)
Route::get('/entry-popup', [EntryPopupController::class, 'index']); // siteye ilk giriste kare pop-up
// Hukuki sayfalar + cerez (KVKK/gizlilik/cerez/kullanim/uyelik) — hepsi herkese acik
Route::get('/legal-pages', [LegalPageController::class, 'index']);
Route::get('/legal-pages/{slug}', [LegalPageController::class, 'show']);
Route::get('/cookies', [CookieController::class, 'entries']); // Cerez Politikasi tablosu
Route::get('/cookie-consent', [CookieController::class, 'consent']); // banner/modal metin + surum + script ID
Route::get('/products', [ProductController::class, 'index']); // fiziksel magaza katalogu (acik)
Route::get('/shop/coin-packages', [PaymentController::class, 'coinPackagesCatalog']); // coin paketleri katalogu (acik; panelden yonetilir)
// Hata Bildir: sag kenar butonundan gonderilen kullanici hata bildirimi. HALKA ACIK
// (misafir de bildirebilir); giris yapmissa BugReportController Bearer token'dan kullaniciyi
// iliskilendirir. Spam/flood korumasi icin IP basi 6/dk (ekran goruntusu 8 MB'a kadar).
Route::middleware('throttle:6,1,bug-report')->post('/bug-report', [BugReportController::class, 'store']);
// İletişim / turnuva organizasyonu talebi: footer "İletişim" + turnuva organizasyonu
// landing'lerindeki formdan gonderilir. HALKA ACIK (misafir de gonderebilir); giris
// yapmissa ContactController Bearer token'dan kullaniciyi iliskilendirir. IP basi 5/dk.
Route::middleware('throttle:5,1,contact')->post('/contact', [ContactController::class, 'store']);
Route::get('/pay/bank-transfer', [PaymentController::class, 'bankInfo']); // havale/EFT bilgisi (acik; kapaliysa enabled:false)
Route::middleware('throttle:120,1,tourn-read')->get('/tournaments/{tournament}', [TournamentController::class, 'show']); // acik poll + autoStartDue -> IP basi sinir
Route::middleware('throttle:120,1,tourn-read')->get('/tournaments/{tournament}/viewers', [TournamentController::class, 'viewers']); // suren maclarin izleyici sayilari (hafif poll)
Route::get('/clubs', [ClubController::class, 'index']);
Route::get('/clubs/{club}', [ClubController::class, 'show']);

// Şans Çarkı durumu (misafir de çarkı görebilir; çevirmek için giriş gerekir).
Route::get('/lucky-wheel', [LuckyWheelController::class, 'show']);

// Zar Slotu durumu (misafir de görebilir; çevirmek için giriş gerekir).
Route::get('/dice-slot', [DiceSlotController::class, 'show']);

// Multiplayer odalari (misafir dostu, token bazli).
// Hiz siniri: mesru istemci hamle basina 1 update + ~1200ms'de 1 poll yapar (~<60/dk).
// 240/dk (IP basi) paylasimli NAT'i bile rahat karsilar ama dev-JSON flood'unu (DB/bant
// genisligi tuketimi) durdurur. Sohbet spam'i icin ayrica daha siki 40/dk.
Route::middleware([EnsureActiveAccount::class, 'throttle:600,1,rooms'])->group(function () {
    // E-POSTA DOGRULAMA ZORUNLU: oyun-GIRIS eylemleri (eslesme/oda-olustur/bot/katil/gir) icin
    // dogrulanmamis kullanici 403 alir (EmailVerified). In-game roll/move'a EKLENMEZ -> deploy aninda
    // devam eden mac kesilmesin (giris zaten engelli).
    Route::post('/matchmaking', [RoomController::class, 'matchmaking'])->middleware(['auth:sanctum', EnsureEmailVerified::class]);
    Route::post('/matchmaking/cancel', [RoomController::class, 'matchmakingCancel'])->middleware('auth:sanctum');
    Route::get('/live-matches', [RoomController::class, 'liveMatches']); // canli maclar (izleme)
    Route::get('/online-players', [RoomController::class, 'onlinePlayers']); // cevrimici oyuncular
    Route::get('/seekers', [RoomController::class, 'seekers']); // oyun arayanlar (hizli eslesme havuzu)
    Route::get('/online-ids', [RoomController::class, 'onlineIds']); // site geneli online durum noktasi (id listesi)
    Route::post('/rooms', [RoomController::class, 'create'])->middleware(EnsureEmailVerified::class);
    // SUNUCU-OTORİTER BOT (PvB): bot maçını sunucuda başlat (state/zar/bot hamlesi sunucuda).
    Route::post('/bot/rooms', [RoomController::class, 'createBotRoom'])->middleware(EnsureEmailVerified::class);
    // Bot dürtme (kurtarma): sıra botta ama senkron sürüş gnubg yokluğunda duraklamışsa tekrar dener.
    Route::post('/rooms/{code}/bot', [RoomController::class, 'botNudge']);
    Route::post('/rooms/{code}/join', [RoomController::class, 'join'])->middleware(EnsureEmailVerified::class);
    Route::post('/rooms/{code}/enter', [RoomController::class, 'enter'])->middleware(EnsureEmailVerified::class);
    Route::post('/rooms/{code}/settle', [RoomController::class, 'settle']);
    Route::post('/rooms/{code}/rematch', [RoomController::class, 'rematch']); // ayni ayarlarla yeni oda
    Route::post('/rooms/{code}/leave', [RoomController::class, 'leave']); // terk -> terk eden kaybeder
    Route::put('/rooms/{code}', [RoomController::class, 'update']);
    // Sunucu-otoriter zar + hamle (para maçı güvenliği Faz 2b)
    Route::post('/rooms/{code}/roll', [RoomController::class, 'roll'])
        ->middleware('throttle:240,1,room-command');
    Route::post('/rooms/{code}/move', [RoomController::class, 'move'])
        ->middleware('throttle:240,1,room-command');
    // Sunucu-otoriter küp + resign (Faz 2)
    Route::post('/rooms/{code}/cube/offer', [RoomController::class, 'cubeOffer'])
        ->middleware('throttle:240,1,room-command');
    Route::post('/rooms/{code}/cube/respond', [RoomController::class, 'cubeRespond'])
        ->middleware('throttle:240,1,room-command');
    Route::post('/rooms/{code}/resign', [RoomController::class, 'resign'])
        ->middleware('throttle:120,1,room-command');
});
// SENKRON CANKURTARANI: oda durum POLL'u (salt-okunur, ucuz) KENDİ BOL limitinde — yazma
// (roll/move) floodu bunu ASLA boğmasın. KÖK FIX: poll ile yazma aynı kovayı paylaşınca, bir
// desync döngüsü kovayı doldurup poll'u da 429'a düşürüyor -> istemci güncel durumu çekemeyip
// kilitli kalıyordu. Poll istemcinin tek kurtuluş yolu: her zaman çalışmalı ki bozuk durumdan
// (maç bitti/desync) senkronla çıkabilsin. 1200/dk = ~20/sn: çok sekme + hızlı poll rahat sığar.
Route::middleware([EnsureActiveAccount::class, 'throttle:1200,1,room-read'])
    ->get('/rooms/{code}', [RoomController::class, 'show']);
Route::middleware([EnsureActiveAccount::class, 'throttle:40,1,chat'])->post('/rooms/{code}/chat', [RoomController::class, 'chat']);
// Kufur/sohbet sikayeti: son 10 satiri yonetime kaydeder (spam kalkani controller'da).
Route::middleware([EnsureActiveAccount::class, 'throttle:10,1,chatreport'])->post('/rooms/{code}/report-chat', [RoomController::class, 'reportChat']);
// Canli hamle onizlemesi (cosmetic): her adim/geri-alma cagrisi -> ayri + genis hiz siniri.
Route::middleware([EnsureActiveAccount::class, 'throttle:600,1,live'])->post('/rooms/{code}/live', [RoomController::class, 'live']);
// Canli mac IZLEME presence (spectator heartbeat): izleyici kaydi + izleyen listesi/sayisi. Herkese acik.
Route::middleware([EnsureActiveAccount::class, 'throttle:120,1,watch'])->post('/rooms/{code}/watch', [RoomController::class, 'watch']);
// Izleyici MAC OZETI: biten odanin "Mac Ozeti" verisi (gnubg review once hesaplanip onbelleklenir;
// herkes AYNI sonucu alir). Herkese acik; agir islem icin dar hiz siniri.
Route::middleware([EnsureActiveAccount::class, 'throttle:30,1,room-summary'])->get('/rooms/{code}/summary', [RoomController::class, 'roomSummary']);
// YÖNETİCİ: izlenen CANLI maçta bir oyuncuyu HÜKMEN attırır (atılan kaybeder + puan kaybı, rakip kazanır).
// 'admin' middleware (EnsureAdmin) = yalnız is_admin. Dar hız sınırı (moderasyon işlemi).
Route::middleware(['auth:sanctum', 'admin', 'throttle:30,1,admin-forfeit'])
    ->post('/rooms/{code}/admin-forfeit', [RoomController::class, 'adminForfeit']);
// GEÇİCİ TEŞHİS (Faz 2): backend Node validator'a ulaşabiliyor mu? Secret/URL AÇMAZ. Sorun
// çözülünce KALDIR. Tarayıcıda /api/validator-check açılır. Limit bol (teşhis için yenilenebilsin).
Route::middleware(['auth:sanctum', 'admin', 'throttle:60,1,validator'])
    ->get('/validator-check', [RoomController::class, 'validatorCheck']);

// Maç kaydı (hamle+zar): TÜM maçlar (pvb/online/local) loglanır. Misafir dostu (auth yok),
// açık uç -> throttle + payload sınırlarıyla korunur (bkz. GameLogController validation).
// Meşru istemci oyun/maç sonunda birkaç kez yazar; 20/dk fazlasıyla yeter.
Route::middleware('throttle:20,1,game-logs')->post('/game-logs', [GameLogController::class, 'store']);
// KANONİK .mat: client "Dışa Aktar" da bu TEK kaynağı kullanır (merged game_logs -> MatFromLog).
// uid yeterince rastgele (yetenek anahtarı); içerik yalnız hamle kaydı -> açık uç (misafir dostu).
Route::middleware('throttle:30,1,game-logs-mat')->get('/game-logs/{uid}/mat', [GameLogController::class, 'mat']);

// Giris gerektiren
Route::middleware(['auth:sanctum', EnsureActiveAccount::class])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])
        ->withoutMiddleware(EnsureActiveAccount::class);
    Route::delete('/account', [AuthController::class, 'deleteAccount']);
    // Push bildirimi: cihaz FCM token'i kaydet/sil (uygulama kabugu - Capacitor native).
    Route::post('/push/register', [PushController::class, 'register']);
    Route::post('/push/unregister', [PushController::class, 'unregister']);
    Route::get('/me', [AuthController::class, 'me']);
    // Cihazdan-bağımsız tercihler (tahta/tema/ses/dil...) -> hesaba bağlı (web↔app senkron).
    Route::post('/me/prefs', [AuthController::class, 'savePrefs']);
    // Arkadaş davet (referral): durum (kod/link/kalan hak) + davet maili gönder (günlük sınır).
    Route::get('/me/referral', [ReferralController::class, 'status']);
    Route::post('/me/referral/invite', [ReferralController::class, 'invite'])
        ->middleware('throttle:10,1,referral-invite');
    // "Şikayetlerim": oyuncunun maç sohbetinde gönderdiği küfür şikayetleri + yönetim sonucu (durum).
    Route::get('/me/chat-reports', [RoomController::class, 'myChatReports']);
    Route::get('/me/matches', [AuthController::class, 'myMatches']);
    Route::get('/me/match-lengths', [AuthController::class, 'myMatchLengths']); // maç tipi filtre seçenekleri
    // Maç Analizleri (derin/gnubg) PREMIUM-only. NOT: sonuç ekranı bu uca çağrı yapıp 403'te
    // sessizce YEREL (yüzeysel) analize düşer -> free kullanıcı yüzeysel, premium derin görür.
    Route::middleware(EnsurePremium::class)->get('/me/matches/{match}/log', [AuthController::class, 'matchLog']); // tam mac analizi
    Route::middleware('throttle:30,1,match-mat')->get('/me/matches/{match}/mat', [AuthController::class, 'matchMat']); // kanonik .mat (Dışa aktar)
    // Maçın hamle-hamle analizini TavlaTV Motoru ile üret (MatReview log'u). Ağır. PREMIUM-only.
    Route::middleware(['throttle:30,1,tavlatv-review', EnsurePremium::class])->get('/me/matches/{match}/tavlatv-review', [AuthController::class, 'matchGnubgReview']);
    Route::get('/me/active-rooms', [RoomController::class, 'myActiveRooms']); // devam eden online maclar
    Route::get('/me/analytics', [AuthController::class, 'analytics']);
    Route::get('/me/performance-stats', [AuthController::class, 'performanceStats']); // Medyan Hata Orani + WXP
    Route::get('/me/wxp-breakdown', [AuthController::class, 'wxpBreakdown']); // WXP kategori kirilimi (coin/1/3/5/7)
    Route::get('/me/dice-stats', [AuthController::class, 'diceStats']); // Zar Ortalamalari (zar-basina Sen/Rakip)
    Route::get('/me/match-pr', [AuthController::class, 'matchPr']); // online mac PR cifti (sunucu-otoriter, tutarli gosterim)
    // Canlı ekran: maç-sonu PR hazır mı (poll). Görünen ad 'match-pr-tavlatv' (marka).
    Route::get('/me/match-pr-tavlatv/{match}', [AuthController::class, 'matchGnubgPr']);
    // Eski istemci sürümleri için geriye dönük alias; aynı auth/policy zincirini kullanır.
    Route::get('/me/match-pr-gnubg/{match}', [AuthController::class, 'matchGnubgPr']);
    // Pozisyon Analizi ekrani "GNU" motoru: yapisal konumu gnubg servisine gonderir (throttle: agir).
    // ÖNEMLİ: throttle'a AYRI PREFIX ver -> Laravel'de isimsiz throttle anahtari sha1(userId) ile
    // TÜM throttled route'lar arasinda PAYLASILIR (rota anahtara girmez). Prefix olmadan; oyun-logu,
    // çark/slot, rating gibi diger aktiviteler ortak sayaci sisirir ve DÜŞÜK limitli bu agir uçlar
    // ilk istekte bile "Too Many Attempts" verir. Prefix her uca KENDI kovasini verir.
    // Pozisyon Analizi PREMIUM-only (derin gnubg konum analizi).
    Route::middleware(['throttle:30,1,analyze-position', EnsurePremium::class])->post('/analyze-position', [AnalysisController::class, 'position']);
    // Mat Analiz sayfasi: yuklenen .mat maci gnubg ile TAM analiz edilir (import mat + analyse match).
    // analyse match agir; yine de test/kullanim icin makul limit. PREMIUM-only.
    Route::middleware(['throttle:5,1,analyze-mat', EnsurePremium::class])->post('/analyze-mat', [AnalysisController::class, 'matchAnalysis']);
    // Mat Analiz FAZ 2: hamle-hamle gorüntüleyici (her hamle icin analiz) -> agir ama makul limit. PREMIUM-only.
    Route::middleware(['throttle:5,1,review-mat', EnsurePremium::class])->post('/review-mat', [AnalysisController::class, 'matchReview']);
    // Mat Analiz GERÇEK ilerleme poll'u (hafif, yalnız /dev/shm dosyası okur -> gnubg'ye dokunmaz). Sık çağrılır -> yüksek throttle.
    Route::get('/review-mat/progress/{key}', [AnalysisController::class, 'matchReviewProgress'])->middleware('throttle:180,1,review-mat-progress');
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    // Haber yorumu birak (kayitli kullanici) -> ONAY BEKLER. Spam korumasi: kullanici basi 5/dk.
    Route::post('/contents/{content}/comments', [ContentCommentController::class, 'store'])
        ->middleware('throttle:5,1,comment-post');

    // reportRating: online macta (room_code) galibiyet/maglubiyet SUNUCU-OTORITER —
    // odanin paylasilan mac skorundan belirlenir, istemci 'won' beyani gecersizse
    // duzeltilir (bkz AuthController::serverResultForRoom). Oda yoksa (pvb) istemciye
    // duser. Throttle: mesru mac dakikalar surer ama 2 istemci x 3 retry + arka arkaya
    // test maclari 12/dk'yi asip 429 -> "puanin kaydedilemedi" verebiliyordu; 30/dk yeterli
    // headroom (reportRating oda+kullanici basi IDEMPOTENT -> yuksek limit guvenli).
    Route::middleware('throttle:30,1,rating-report')->post('/rating/report', [AuthController::class, 'reportRating']);
    Route::post('/email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:6,1,email-resend');
    Route::post('/email/verify-code', [AuthController::class, 'verifyEmailCode'])->middleware('throttle:10,1,email-verify');
    // Telefon OTP: kod gonder (60sn cooldown + 6/dk) ve dogrula (5/dk). Islemsel SMS.
    // verify 10->5/dk + AuthController'da hesap-bazli kalici kilit (kod yenilense de
    // toplam deneme sayilir) -> 6 haneli kod brute-force ile ele gecirilemez.
    Route::post('/phone/send-otp', [AuthController::class, 'sendPhoneOtp'])->middleware('throttle:6,1,phone-otp');
    Route::post('/phone/verify-otp', [AuthController::class, 'verifyPhoneOtp'])->middleware('throttle:5,1,phone-verify');
    Route::post('/membership/trial', [MembershipController::class, 'startTrial']);
    Route::post('/membership/auto-renew', [MembershipController::class, 'autoRenew']);
    // Ödeme/promo başlangıçlarında kullanıcı başına ayrı kova: pending ödeme ve promo
    // doğrulama satırlarının spam ile büyümesini engeller; callback limiti ayrıdır.
    Route::middleware('throttle:10,1,payment-checkout')->group(function () {
        Route::post('/subscribe', [PaymentController::class, 'subscribe']);
        Route::post('/shop/coins', [PaymentController::class, 'buyCoins']); // sepetteki coin paketleri -> odeme
        Route::post('/shop/membership', [PaymentController::class, 'buyMembership']); // "Üyeliğini Uzat" -> 1 yil premium -> odeme
    });
    Route::post('/shop/promo/validate', [PaymentController::class, 'promoValidate'])
        ->middleware('throttle:30,1,promo-validate'); // indirim kodu dogrula (sunucu)

    Route::get('/friends', [FriendController::class, 'index']);
    Route::post('/friends/request', [FriendController::class, 'request'])
        ->middleware('throttle:20,1,friend-request'); // id-numaralama taramasini yavaslat (yoksa 404/200 ile hesap varligi sizar)
    Route::post('/friends/{userId}/accept', [FriendController::class, 'accept']);
    Route::delete('/friends/{userId}', [FriendController::class, 'destroy']);

    // Arkadaslar arasi ozel mesajlasma (DM)
    Route::get('/messages', [MessageController::class, 'threads']);
    Route::get('/messages/unread', [MessageController::class, 'unread']);
    Route::get('/messages/{userId}', [MessageController::class, 'thread'])->whereNumber('userId');
    Route::post('/messages/{userId}', [MessageController::class, 'send'])
        ->whereNumber('userId')->middleware('throttle:30,1,msg-send'); // spam/flood korumasi
    // Kendi mesajını düzenle (gönderimden sonra 5 dk içinde; controller'da sahiplik + süre + küfür denetimi).
    Route::patch('/messages/{userId}/{messageId}', [MessageController::class, 'edit'])
        ->whereNumber('userId')->whereNumber('messageId')->middleware('throttle:30,1,msg-edit');
    Route::post('/messages/{userId}/typing', [MessageController::class, 'typing'])
        ->whereNumber('userId')->middleware('throttle:60,1,msg-typing'); // "yaziyor…" nabzi
    // Mesaj isteği: arkadaş olmayanın konuşması "istek" olarak düşer -> kabul / reddet.
    Route::post('/messages/{userId}/accept', [MessageController::class, 'accept'])
        ->whereNumber('userId');
    Route::post('/messages/{userId}/decline', [MessageController::class, 'decline'])
        ->whereNumber('userId');
    // Kebab menüsü: kullanıcı sohbeti SİLER (kendine özel gizleme) + BLOKLA / blok kaldır.
    Route::delete('/messages/{userId}', [MessageController::class, 'deleteConversation'])
        ->whereNumber('userId');
    // Küfür/uygunsuz DM şikayeti: iki kişi arasındaki tüm yazışmayı yönetime kaydeder.
    Route::post('/messages/{userId}/report', [MessageController::class, 'report'])
        ->whereNumber('userId')->middleware('throttle:10,1,dm-report');
    Route::post('/messages/{userId}/block', [MessageController::class, 'block'])
        ->whereNumber('userId');
    Route::delete('/messages/{userId}/block', [MessageController::class, 'unblock'])
        ->whereNumber('userId');
    // Yonetici: DM mesajini sil (controller icinde is_admin denetimi var).
    Route::delete('/messages/{userId}/{messageId}', [MessageController::class, 'destroy'])
        ->whereNumber('userId')->whereNumber('messageId');

    Route::post('/ping', [PresenceController::class, 'ping'])->middleware('throttle:60,1,ping'); // A-29
    Route::post('/me/presence-status', [PresenceController::class, 'setStatus']); // oyuncu durumu (musait/hazir/mesgul/cevrimdisi)
    Route::post('/notifications/read', [PresenceController::class, 'readNotifications']);
    Route::post('/notifications/delete', [PresenceController::class, 'deleteNotifications']);
    Route::post('/friends/{userId}/invite', [PresenceController::class, 'invite'])->middleware('throttle:10,1,invite'); // A-29
    Route::post('/invites/cancel', [PresenceController::class, 'cancelInvite']); // davet EDEN iptal eder
    Route::post('/invites/{inviteId}/respond', [PresenceController::class, 'respond']);

    Route::get('/me/club', [ClubController::class, 'mine']);
    Route::post('/clubs', [ClubController::class, 'create']);
    Route::post('/clubs/{club}/join', [ClubController::class, 'join']);
    Route::post('/clubs/leave', [ClubController::class, 'leave']);

    Route::post('/tournaments', [TournamentController::class, 'create']);
    // Online Turnuvalar: liste/detay herkese acik (misafir dahil). Katilim kapisi turnuva basina (premium_only) -> TournamentController::join. Misafir: auth:sanctum.
    Route::post('/tournaments/{tournament}/join', [TournamentController::class, 'join']);
    Route::post('/tournaments/{tournament}/leave', [TournamentController::class, 'leave']);
    Route::post('/tournaments/{tournament}/disqualify', [TournamentController::class, 'disqualify']); // diskalifiye (yalniz yonetici)
    Route::post('/tournaments/{tournament}/report', [TournamentController::class, 'report']);
    Route::post('/tournaments/{tournament}/no-show', [TournamentController::class, 'noShow']); // rakip gelmedi -> hukmen
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
        Route::post('/admin/users/{user}/chat-mute', [AdminController::class, 'chatMute']); // profil üstü konuşma yasağı
        Route::post('/admin/users/{user}/note', [AdminController::class, 'setNote']); // profil üstü admin notu
        // Icerik yonetimi (hizmet/blog/haber/etkinlik/kulup)
        Route::get('/admin/contents', [ContentController::class, 'adminIndex']);
        Route::post('/admin/contents', [ContentController::class, 'store']);
        Route::put('/admin/contents/{content}', [ContentController::class, 'update']);
        Route::delete('/admin/contents/{content}', [ContentController::class, 'destroy']);

        // Şans Çarkı yönetimi (Filament'e paralel REST). Yazımlar model event'i ile audit'lenir.
        Route::get('/admin/lucky-wheel/rewards', [LuckyWheelAdminController::class, 'rewards']);
        Route::post('/admin/lucky-wheel/rewards', [LuckyWheelAdminController::class, 'storeReward']);
        Route::put('/admin/lucky-wheel/rewards/{reward}', [LuckyWheelAdminController::class, 'updateReward']);
        Route::delete('/admin/lucky-wheel/rewards/{reward}', [LuckyWheelAdminController::class, 'destroyReward']);
        Route::get('/admin/lucky-wheel/settings', [LuckyWheelAdminController::class, 'getSettings']);
        Route::put('/admin/lucky-wheel/settings', [LuckyWheelAdminController::class, 'updateSettings']);
        Route::post('/admin/lucky-wheel/reorder', [LuckyWheelAdminController::class, 'reorder']);
    });

    Route::get('/shop', [ShopController::class, 'index']);
    Route::post('/shop/buy', [ShopController::class, 'buy']);
    Route::post('/shop/frame', [ShopController::class, 'selectFrame']);
    Route::post('/shop/checker', [ShopController::class, 'selectChecker']);
    Route::post('/shop/daily', [ShopController::class, 'daily']);

    // Şans Çarkı çevirme: sonuç SUNUCU-OTORİTER (weighted random). Flood/bot koruması THROTTLE ile;
    // asıl koruma ekonomidedir (günlük ücretsiz hak + limit + atomik sunucu kontrolü). 20/dk hızlı
    // seri çevirmede "Too Many Attempts" veriyordu → 60/dk (bkz Zar Slotu ile aynı düzeltme).
    Route::middleware('throttle:60,1,lucky-wheel')->post('/lucky-wheel/spin', [LuckyWheelController::class, 'spin']);

    // Zar Slotu çevirme: sonuç SUNUCU-OTORİTER (weighted random). Flood/bot koruması THROTTLE ile;
    // asıl kötüye-kullanım koruması ekonomidedir (günlük ücretsiz hak + coin bedeli + atomik sunucu
    // kontrolü). Limit hızlı ELLE oynamaya yetecek kadar geniş (buton her spinde ~2.3s kilitli →
    // en fazla ~26/dk); 20/dk "Too Many Attempts" veriyordu, 60/dk'ya çıkarıldı.
    Route::middleware('throttle:60,1,dice-slot')->post('/dice-slot/spin', [DiceSlotController::class, 'spin']);

    // Fiziksel urun magazasi: siparis (coin aninda / money -> odeme) + kullanicinin siparisleri.
    Route::post('/products/order', [ProductController::class, 'order']);
    Route::post('/products/cart/coin', [ProductController::class, 'cartCoinOrder']); // sepetteki coin urunleri (aninda, cok-urun)
    Route::get('/me/orders', [ProductController::class, 'myOrders']);

    // Adres defteri (Adreslerim): teslimat + fatura adresleri CRUD.
    Route::get('/addresses', [AddressController::class, 'index']);
    Route::post('/addresses', [AddressController::class, 'store']);
    Route::put('/addresses/{address}', [AddressController::class, 'update'])->whereNumber('address');
    Route::delete('/addresses/{address}', [AddressController::class, 'destroy'])->whereNumber('address');

    // Sepet ödemesi: para (coin paketleri + para-ürünleri) TEK Garanti ödemesi (kind='cart').
    Route::post('/shop/cart-checkout', [PaymentController::class, 'cartCheckout'])
        ->middleware('throttle:10,1,payment-checkout');

    // Hata Günlüğü GÖRÜNTÜLEME PREMIUM-only. store (POST) açık kalır: free kullanıcının
    // hataları toplanmaya devam eder -> premiuma yükseltince geçmiş hazır olur.
    Route::middleware(EnsurePremium::class)->get('/blunders', [BlunderController::class, 'index']);
    Route::post('/blunders', [BlunderController::class, 'store']);

    // Hata Gunlugu: gunun/donemin ozeti + kategori kirilimi + son hatalar (decision_analyses'ten). PREMIUM-only.
    Route::middleware(EnsurePremium::class)->get('/me/error-journal', [ErrorJournalController::class, 'index']);

    // Basarimlar (achievements): katalog+progress, sergilenen rozet, gorulmemis unlock'lar.
    Route::get('/me/achievements', [AchievementController::class, 'index']);
    Route::post('/me/achievements/featured', [AchievementController::class, 'setFeatured']);
    Route::get('/me/achievements/unseen', [AchievementController::class, 'unseen']);

    Route::get('/game', [GameController::class, 'show']);
    Route::middleware('throttle:60,1,game-save')->put('/game', [GameController::class, 'save']);
    Route::delete('/game', [GameController::class, 'clear']);
});
