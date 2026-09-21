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
Route::middleware('throttle:10,1,auth-login')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});
Route::middleware('throttle:20,1,auth-register')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/auth/google', [AuthController::class, 'googleLogin']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
});
// Kullanici numaralama (enumeration) yavaslatma: halka acik + hiz sinirli
Route::middleware('throttle:30,1,nickname')->get('/nickname-available', [AuthController::class, 'nicknameAvailable']);
Route::get('/leaderboard', [AuthController::class, 'leaderboard']);
Route::get('/leaderboard/pr', [AuthController::class, 'prLeaderboard']); // PR Sıralaması (Career PR)
Route::get('/achievements', [\App\Http\Controllers\AchievementController::class, 'publicCatalog']); // Bilgi>Rozetler (misafir dahil)
Route::get('/users/{user}/profile', [AuthController::class, 'publicProfile']); // herkese acik profil
Route::get('/contents', [ContentController::class, 'index']); // hizmet/blog/haber/etkinlik/kulup (acik)
Route::get('/info-pages', [\App\Http\Controllers\InfoPageController::class, 'index']); // /bilgi/<slug> sekmeleri (acik)
Route::get('/menu-config', [\App\Http\Controllers\MenuController::class, 'index']); // sol menu sira/ad/gorunurluk (acik)
Route::get('/tournaments', [TournamentController::class, 'index']);
Route::get('/tournament-ads', [TournamentAdController::class, 'index']); // ana sayfa reklam serisi
Route::get('/ad-slots', [\App\Http\Controllers\AdSlotController::class, 'index']); // paneller arasi reklam seritleri
Route::get('/entry-popup', [\App\Http\Controllers\EntryPopupController::class, 'index']); // siteye ilk giriste kare pop-up
// Hukuki sayfalar + cerez (KVKK/gizlilik/cerez/kullanim/uyelik) — hepsi herkese acik
Route::get('/legal-pages', [\App\Http\Controllers\LegalPageController::class, 'index']);
Route::get('/legal-pages/{slug}', [\App\Http\Controllers\LegalPageController::class, 'show']);
Route::get('/cookies', [\App\Http\Controllers\CookieController::class, 'entries']); // Cerez Politikasi tablosu
Route::get('/cookie-consent', [\App\Http\Controllers\CookieController::class, 'consent']); // banner/modal metin + surum + script ID
Route::get('/products', [\App\Http\Controllers\ProductController::class, 'index']); // fiziksel magaza katalogu (acik)
// Hata Bildir: sag kenar butonundan gonderilen kullanici hata bildirimi. HALKA ACIK
// (misafir de bildirebilir); giris yapmissa BugReportController Bearer token'dan kullaniciyi
// iliskilendirir. Spam/flood korumasi icin IP basi 6/dk (ekran goruntusu 8 MB'a kadar).
Route::middleware('throttle:6,1,bug-report')->post('/bug-report', [\App\Http\Controllers\BugReportController::class, 'store']);
Route::get('/pay/bank-transfer', [\App\Http\Controllers\PaymentController::class, 'bankInfo']); // havale/EFT bilgisi (acik; kapaliysa enabled:false)
Route::get('/tournaments/{tournament}', [TournamentController::class, 'show']);
Route::get('/clubs', [ClubController::class, 'index']);
Route::get('/clubs/{club}', [ClubController::class, 'show']);

// Şans Çarkı durumu (misafir de çarkı görebilir; çevirmek için giriş gerekir).
Route::get('/lucky-wheel', [\App\Http\Controllers\LuckyWheelController::class, 'show']);

// Zar Slotu durumu (misafir de görebilir; çevirmek için giriş gerekir).
Route::get('/dice-slot', [\App\Http\Controllers\DiceSlotController::class, 'show']);


// Multiplayer odalari (misafir dostu, token bazli).
// Hiz siniri: mesru istemci hamle basina 1 update + ~1200ms'de 1 poll yapar (~<60/dk).
// 240/dk (IP basi) paylasimli NAT'i bile rahat karsilar ama dev-JSON flood'unu (DB/bant
// genisligi tuketimi) durdurur. Sohbet spam'i icin ayrica daha siki 40/dk.
Route::middleware([\App\Http\Middleware\EnsureActiveAccount::class, 'throttle:240,1,rooms'])->group(function () {
    Route::post('/matchmaking', [RoomController::class, 'matchmaking'])->middleware('auth:sanctum');
    Route::post('/matchmaking/cancel', [RoomController::class, 'matchmakingCancel'])->middleware('auth:sanctum');
    Route::get('/live-matches', [RoomController::class, 'liveMatches']); // canli maclar (izleme)
    Route::get('/online-players', [RoomController::class, 'onlinePlayers']); // cevrimici oyuncular
    Route::post('/rooms', [RoomController::class, 'create']);
    // SUNUCU-OTORİTER BOT (PvB): bot maçını sunucuda başlat (state/zar/bot hamlesi sunucuda).
    Route::post('/bot/rooms', [RoomController::class, 'createBotRoom']);
    // Bot dürtme (kurtarma): sıra botta ama senkron sürüş gnubg yokluğunda duraklamışsa tekrar dener.
    Route::post('/rooms/{code}/bot', [RoomController::class, 'botNudge']);
    Route::post('/rooms/{code}/join', [RoomController::class, 'join']);
    Route::post('/rooms/{code}/enter', [RoomController::class, 'enter']);
    Route::post('/rooms/{code}/settle', [RoomController::class, 'settle']);
    Route::post('/rooms/{code}/rematch', [RoomController::class, 'rematch']); // ayni ayarlarla yeni oda
    Route::post('/rooms/{code}/leave', [RoomController::class, 'leave']); // terk -> terk eden kaybeder
    Route::get('/rooms/{code}', [RoomController::class, 'show']);
    Route::put('/rooms/{code}', [RoomController::class, 'update']);
    // Sunucu-otoriter zar + hamle (para maçı güvenliği Faz 2b)
    Route::post('/rooms/{code}/roll', [RoomController::class, 'roll']);
    Route::post('/rooms/{code}/move', [RoomController::class, 'move']);
    // Sunucu-otoriter küp + resign (Faz 2)
    Route::post('/rooms/{code}/cube/offer', [RoomController::class, 'cubeOffer']);
    Route::post('/rooms/{code}/cube/respond', [RoomController::class, 'cubeRespond']);
    Route::post('/rooms/{code}/resign', [RoomController::class, 'resign']);
});
Route::middleware([\App\Http\Middleware\EnsureActiveAccount::class, 'throttle:40,1,chat'])->post('/rooms/{code}/chat', [RoomController::class, 'chat']);
// Canli hamle onizlemesi (cosmetic): her adim/geri-alma cagrisi -> ayri + genis hiz siniri.
Route::middleware([\App\Http\Middleware\EnsureActiveAccount::class, 'throttle:600,1,live'])->post('/rooms/{code}/live', [RoomController::class, 'live']);
// Canli mac IZLEME presence (spectator heartbeat): izleyici kaydi + izleyen listesi/sayisi. Herkese acik.
Route::middleware([\App\Http\Middleware\EnsureActiveAccount::class, 'throttle:120,1,watch'])->post('/rooms/{code}/watch', [RoomController::class, 'watch']);
// GEÇİCİ TEŞHİS (Faz 2): backend Node validator'a ulaşabiliyor mu? Secret/URL AÇMAZ. Sorun
// çözülünce KALDIR. Tarayıcıda /api/validator-check açılır. Limit bol (teşhis için yenilenebilsin).
Route::middleware(['auth:sanctum', 'admin', 'throttle:60,1,validator'])
    ->get('/validator-check', [RoomController::class, 'validatorCheck']);

// Maç kaydı (hamle+zar): TÜM maçlar (pvb/online/local) loglanır. Misafir dostu (auth yok),
// açık uç -> throttle + payload sınırlarıyla korunur (bkz. GameLogController validation).
// Meşru istemci oyun/maç sonunda birkaç kez yazar; 20/dk fazlasıyla yeter.
Route::middleware('throttle:20,1,game-logs')->post('/game-logs', [\App\Http\Controllers\GameLogController::class, 'store']);
// KANONİK .mat: client "Dışa Aktar" da bu TEK kaynağı kullanır (merged game_logs -> MatFromLog).
// uid yeterince rastgele (yetenek anahtarı); içerik yalnız hamle kaydı -> açık uç (misafir dostu).
Route::middleware('throttle:30,1,game-logs-mat')->get('/game-logs/{uid}/mat', [\App\Http\Controllers\GameLogController::class, 'mat']);

// Giris gerektiren
Route::middleware(['auth:sanctum', \App\Http\Middleware\EnsureActiveAccount::class])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])
        ->withoutMiddleware(\App\Http\Middleware\EnsureActiveAccount::class);
    Route::delete('/account', [AuthController::class, 'deleteAccount']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/me/matches', [AuthController::class, 'myMatches']);
    Route::get('/me/matches/{match}/log', [AuthController::class, 'matchLog']); // tam mac analizi
    Route::middleware('throttle:30,1,match-mat')->get('/me/matches/{match}/mat', [AuthController::class, 'matchMat']); // kanonik .mat (Dışa aktar)
    // HAKEM=gnubg: maçın hamle-hamle analizini gnubg ile üret (MatchReport gnubg log'u). Ağır (gnubg).
    Route::middleware('throttle:30,1,gnubg-review')->get('/me/matches/{match}/gnubg-review', [AuthController::class, 'matchGnubgReview']);
    Route::get('/me/active-rooms', [RoomController::class, 'myActiveRooms']); // devam eden online maclar
    Route::get('/me/analytics', [AuthController::class, 'analytics']);
    Route::get('/me/performance-stats', [AuthController::class, 'performanceStats']); // Medyan Hata Orani + WXP
    Route::get('/me/wxp-breakdown', [AuthController::class, 'wxpBreakdown']); // WXP kategori kirilimi (coin/1/3/5/7)
    Route::get('/me/dice-stats', [AuthController::class, 'diceStats']); // Zar Ortalamalari (zar-basina Sen/Rakip)
    Route::get('/me/match-pr', [AuthController::class, 'matchPr']); // online mac PR cifti (sunucu-otoriter, tutarli gosterim)
    Route::get('/me/match-pr-gnubg/{match}', [AuthController::class, 'matchGnubgPr']); // canli ekran: gnubg PR hazir mi (HAKEM=gnubg poll)
    // Pozisyon Analizi ekrani "GNU" motoru: yapisal konumu gnubg servisine gonderir (throttle: agir).
    // ÖNEMLİ: throttle'a AYRI PREFIX ver -> Laravel'de isimsiz throttle anahtari sha1(userId) ile
    // TÜM throttled route'lar arasinda PAYLASILIR (rota anahtara girmez). Prefix olmadan; oyun-logu,
    // çark/slot, rating gibi diger aktiviteler ortak sayaci sisirir ve DÜŞÜK limitli bu agir uçlar
    // ilk istekte bile "Too Many Attempts" verir. Prefix her uca KENDI kovasini verir.
    Route::middleware('throttle:30,1,analyze-position')->post('/analyze-position', [\App\Http\Controllers\AnalysisController::class, 'position']);
    // Mat Analiz sayfasi: yuklenen .mat maci gnubg ile TAM analiz edilir (import mat + analyse match).
    // analyse match agir; yine de test/kullanim icin makul limit.
    Route::middleware('throttle:30,1,analyze-mat')->post('/analyze-mat', [\App\Http\Controllers\AnalysisController::class, 'matchAnalysis']);
    // Mat Analiz FAZ 2: hamle-hamle gorüntüleyici (her hamle icin analiz) -> agir ama makul limit.
    Route::middleware('throttle:30,1,review-mat')->post('/review-mat', [\App\Http\Controllers\AnalysisController::class, 'matchReview']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    // reportRating: online macta (room_code) galibiyet/maglubiyet SUNUCU-OTORITER —
    // odanin paylasilan mac skorundan belirlenir, istemci 'won' beyani gecersizse
    // duzeltilir (bkz AuthController::serverResultForRoom). Oda yoksa (pvb) istemciye
    // duser. Throttle: mesru mac dakikalar surer ama 2 istemci x 3 retry + arka arkaya
    // test maclari 12/dk'yi asip 429 -> "puanin kaydedilemedi" verebiliyordu; 30/dk yeterli
    // headroom (reportRating oda+kullanici basi IDEMPOTENT -> yuksek limit guvenli).
    Route::middleware('throttle:30,1,rating-report')->post('/rating/report', [AuthController::class, 'reportRating']);
    Route::post('/email/resend', [AuthController::class, 'resendVerification']);
    Route::post('/membership/trial', [MembershipController::class, 'startTrial']);
    Route::post('/membership/auto-renew', [MembershipController::class, 'autoRenew']);
    Route::post('/subscribe', [\App\Http\Controllers\PaymentController::class, 'subscribe']);
    Route::post('/shop/coins', [\App\Http\Controllers\PaymentController::class, 'buyCoins']); // sepetteki coin paketleri -> odeme
    Route::post('/shop/membership', [\App\Http\Controllers\PaymentController::class, 'buyMembership']); // "Üyeliğini Uzat" -> 1 yil premium -> odeme
    Route::post('/shop/promo/validate', [\App\Http\Controllers\PaymentController::class, 'promoValidate']); // indirim kodu dogrula (sunucu)

    Route::get('/friends', [FriendController::class, 'index']);
    Route::post('/friends/request', [FriendController::class, 'request']);
    Route::post('/friends/{userId}/accept', [FriendController::class, 'accept']);
    Route::delete('/friends/{userId}', [FriendController::class, 'destroy']);

    // Arkadaslar arasi ozel mesajlasma (DM)
    Route::get('/messages', [\App\Http\Controllers\MessageController::class, 'threads']);
    Route::get('/messages/unread', [\App\Http\Controllers\MessageController::class, 'unread']);
    Route::get('/messages/{userId}', [\App\Http\Controllers\MessageController::class, 'thread'])->whereNumber('userId');
    Route::post('/messages/{userId}', [\App\Http\Controllers\MessageController::class, 'send'])
        ->whereNumber('userId')->middleware('throttle:30,1,msg-send'); // spam/flood korumasi
    Route::post('/messages/{userId}/typing', [\App\Http\Controllers\MessageController::class, 'typing'])
        ->whereNumber('userId')->middleware('throttle:60,1,msg-typing'); // "yaziyor…" nabzi
    // Mesaj isteği: arkadaş olmayanın konuşması "istek" olarak düşer -> kabul / reddet.
    Route::post('/messages/{userId}/accept', [\App\Http\Controllers\MessageController::class, 'accept'])
        ->whereNumber('userId');
    Route::post('/messages/{userId}/decline', [\App\Http\Controllers\MessageController::class, 'decline'])
        ->whereNumber('userId');
    // Yonetici: DM mesajini sil (controller icinde is_admin denetimi var).
    Route::delete('/messages/{userId}/{messageId}', [\App\Http\Controllers\MessageController::class, 'destroy'])
        ->whereNumber('userId')->whereNumber('messageId');

    Route::post('/ping', [PresenceController::class, 'ping']);
    Route::post('/me/presence-status', [PresenceController::class, 'setStatus']); // oyuncu durumu (musait/hazir/mesgul/cevrimdisi)
    Route::post('/notifications/read', [PresenceController::class, 'readNotifications']);
    Route::post('/notifications/delete', [PresenceController::class, 'deleteNotifications']);
    Route::post('/friends/{userId}/invite', [PresenceController::class, 'invite']);
    Route::post('/invites/cancel', [PresenceController::class, 'cancelInvite']); // davet EDEN iptal eder
    Route::post('/invites/{inviteId}/respond', [PresenceController::class, 'respond']);

    Route::get('/me/club', [ClubController::class, 'mine']);
    Route::post('/clubs', [ClubController::class, 'create']);
    Route::post('/clubs/{club}/join', [ClubController::class, 'join']);
    Route::post('/clubs/leave', [ClubController::class, 'leave']);

    Route::post('/tournaments', [TournamentController::class, 'create']);
    Route::post('/tournaments/{tournament}/join', [TournamentController::class, 'join']);
    Route::post('/tournaments/{tournament}/leave', [TournamentController::class, 'leave']);
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
        // Icerik yonetimi (hizmet/blog/haber/etkinlik/kulup)
        Route::get('/admin/contents', [ContentController::class, 'adminIndex']);
        Route::post('/admin/contents', [ContentController::class, 'store']);
        Route::put('/admin/contents/{content}', [ContentController::class, 'update']);
        Route::delete('/admin/contents/{content}', [ContentController::class, 'destroy']);

        // Şans Çarkı yönetimi (Filament'e paralel REST). Yazımlar model event'i ile audit'lenir.
        Route::get('/admin/lucky-wheel/rewards', [\App\Http\Controllers\LuckyWheelAdminController::class, 'rewards']);
        Route::post('/admin/lucky-wheel/rewards', [\App\Http\Controllers\LuckyWheelAdminController::class, 'storeReward']);
        Route::put('/admin/lucky-wheel/rewards/{reward}', [\App\Http\Controllers\LuckyWheelAdminController::class, 'updateReward']);
        Route::delete('/admin/lucky-wheel/rewards/{reward}', [\App\Http\Controllers\LuckyWheelAdminController::class, 'destroyReward']);
        Route::get('/admin/lucky-wheel/settings', [\App\Http\Controllers\LuckyWheelAdminController::class, 'getSettings']);
        Route::put('/admin/lucky-wheel/settings', [\App\Http\Controllers\LuckyWheelAdminController::class, 'updateSettings']);
        Route::post('/admin/lucky-wheel/reorder', [\App\Http\Controllers\LuckyWheelAdminController::class, 'reorder']);
    });

    Route::get('/shop', [ShopController::class, 'index']);
    Route::post('/shop/buy', [ShopController::class, 'buy']);
    Route::post('/shop/frame', [ShopController::class, 'selectFrame']);
    Route::post('/shop/checker', [ShopController::class, 'selectChecker']);
    Route::post('/shop/daily', [ShopController::class, 'daily']);

    // Şans Çarkı çevirme: sonuç SUNUCU-OTORİTER (weighted random). Flood/bot koruması THROTTLE ile;
    // asıl koruma ekonomidedir (günlük ücretsiz hak + limit + atomik sunucu kontrolü). 20/dk hızlı
    // seri çevirmede "Too Many Attempts" veriyordu → 60/dk (bkz Zar Slotu ile aynı düzeltme).
    Route::middleware('throttle:60,1,lucky-wheel')->post('/lucky-wheel/spin', [\App\Http\Controllers\LuckyWheelController::class, 'spin']);

    // Zar Slotu çevirme: sonuç SUNUCU-OTORİTER (weighted random). Flood/bot koruması THROTTLE ile;
    // asıl kötüye-kullanım koruması ekonomidedir (günlük ücretsiz hak + coin bedeli + atomik sunucu
    // kontrolü). Limit hızlı ELLE oynamaya yetecek kadar geniş (buton her spinde ~2.3s kilitli →
    // en fazla ~26/dk); 20/dk "Too Many Attempts" veriyordu, 60/dk'ya çıkarıldı.
    Route::middleware('throttle:60,1,dice-slot')->post('/dice-slot/spin', [\App\Http\Controllers\DiceSlotController::class, 'spin']);

    // Fiziksel urun magazasi: siparis (coin aninda / money -> odeme) + kullanicinin siparisleri.
    Route::post('/products/order', [\App\Http\Controllers\ProductController::class, 'order']);
    Route::post('/products/cart/coin', [\App\Http\Controllers\ProductController::class, 'cartCoinOrder']); // sepetteki coin urunleri (aninda, cok-urun)
    Route::get('/me/orders', [\App\Http\Controllers\ProductController::class, 'myOrders']);

    // Adres defteri (Adreslerim): teslimat + fatura adresleri CRUD.
    Route::get('/addresses', [\App\Http\Controllers\AddressController::class, 'index']);
    Route::post('/addresses', [\App\Http\Controllers\AddressController::class, 'store']);
    Route::put('/addresses/{address}', [\App\Http\Controllers\AddressController::class, 'update'])->whereNumber('address');
    Route::delete('/addresses/{address}', [\App\Http\Controllers\AddressController::class, 'destroy'])->whereNumber('address');

    // Sepet ödemesi: para (coin paketleri + para-ürünleri) TEK Garanti ödemesi (kind='cart').
    Route::post('/shop/cart-checkout', [\App\Http\Controllers\PaymentController::class, 'cartCheckout']);

    Route::get('/blunders', [BlunderController::class, 'index']);
    Route::post('/blunders', [BlunderController::class, 'store']);

    // Hata Gunlugu: gunun/donemin ozeti + kategori kirilimi + son hatalar (decision_analyses'ten).
    Route::get('/me/error-journal', [ErrorJournalController::class, 'index']);

    // Basarimlar (achievements): katalog+progress, sergilenen rozet, gorulmemis unlock'lar.
    Route::get('/me/achievements', [\App\Http\Controllers\AchievementController::class, 'index']);
    Route::post('/me/achievements/featured', [\App\Http\Controllers\AchievementController::class, 'setFeatured']);
    Route::get('/me/achievements/unseen', [\App\Http\Controllers\AchievementController::class, 'unseen']);

    Route::get('/game', [GameController::class, 'show']);
    Route::middleware('throttle:60,1,game-save')->put('/game', [GameController::class, 'save']);
    Route::delete('/game', [GameController::class, 'clear']);
});
