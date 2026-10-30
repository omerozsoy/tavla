<?php

use App\Exceptions\TransientAnalysisException;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\ShieldTracker;
use App\Http\Middleware\SiteGate;
use App\Support\Alert;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Queue\MaxAttemptsExceededException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Livewire\Features\SupportLockedProperties\CannotUpdateLockedPropertyException;
use Psy\Exception\Exception;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => EnsureAdmin::class,
        ]);
        $middleware->append(SecurityHeaders::class);
        // "Kapali test" sifre kapisi: SITE_PASSWORD doluysa tum /api istekleri X-Site-Gate ister.
        // En basta kossun ki reddedilen istek hicbir controller'a/hataya ulasmasin.
        $middleware->prependToGroup('api', SiteGate::class);
        // Guvenlik Kalkani izleyicisi: TUM /api isteklerini yanit-sonrasi kaydeder (kim, nerede,
        // kac istek, hata/spin/tarama, risk). Sona eklenir ki auth cozulmus + durum kodu belli olsun.
        $middleware->appendToGroup('api', ShieldTracker::class);
        // KÖK FIX ("Route [login] not defined" 500'leri — 1/2): Laravel 11 VARSAYILAN olarak
        // redirectGuestsTo(fn () => route('login')) kurar. Bu backend SPA/mobil API'dir; 'login' ADLI
        // web rotası YOKTUR. auth:sanctum'a takılan kimliksiz + JSON-beklemeyen istek (crawler / adres
        // çubuğuna yapıştırma / link önizleme botu) Authenticate middleware'inde redirectTo->route('login')
        // çağırıp RouteNotFoundException (GERÇEK 500 + "🔴 Sunucu HATASI" spam) fırlatır. api/* için
        // redirect'i İPTAL et (null) -> middleware düz 401'lik AuthenticationException fırlatır; aşağıdaki
        // shouldRenderJsonWhen (2/2) bunu 401 JSON'a çevirir. Web/Filament kendi guard'ını kullanır.
        $middleware->redirectGuestsTo(
            fn ($request) => $request->is('api/*') ? null : route('login')
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // KÖK FIX ("Route [login] not defined" 500'leri — 2/2): /api/* (ya da JSON bekleyen) her istekte
        // hata yanıtı DAİMA JSON render edilsin. Böylece kimliksiz api isteği `Accept: text/html` yollasa
        // bile (crawler / adres çubuğu / link önizleme botu) Handler->unauthenticated() redirect()->guest(
        // route('login')) yoluna GİRMEZ -> RouteNotFoundException (500) yerine 401 JSON döner. Filament
        // /admin kendi guard'ını (filament.admin.auth.login) kullanır -> etkilenmez.
        $exceptions->shouldRenderJsonWhen(
            fn ($request, Throwable $e) => $request->is('api/*') || $request->expectsJson()
        );
        // SENTRY SUSTURMA (kök — issue 157231002/157180076): Aşağıdaki report() callback'i VOID döner
        // -> yalnız ÖZEL alarmı (e-posta/WA) atlar; Sentry (sentry-laravel) AYRI raporlar ve void dönüş
        // onu DURDURMAZ -> Sentry alarmı atmaya devam ediyordu. dontReport Laravel'in shouldntReport
        // listesine girer; sentry-laravel bunu RESPECT eder -> hem Sentry hem log gürültüsü kesilir.
        // CannotUpdateLockedPropertyException = Livewire'ın @locked guard'ı: `/livewire/update`'e gelen
        // BAYAT snapshot (deploy anında admin'in açık Filament sayfası) VEYA bot/tamper isteği kilitli
        // bir özelliği güncellemeye çalışınca fırlar. SUNUCU HATASI DEĞİL (düzeltilecek kod yok; sayfa
        // yenileyince geçer) -> gürültü. Gerçek 500'ler ETKİLENMEZ.
        $exceptions->dontReport([
            CannotUpdateLockedPropertyException::class,
        ]);
        // AKSAMA UYARISI: canlı bir istek SUNUCU HATASI (500) ile patlarsa admin'e e-posta +
        // WhatsApp. Beklenen/istemci hataları (validation 422, auth 401/403, 404, throttle 429)
        // ATLANIR -> yalnız gerçek 500'ler uyarır. 15 dk spam-limit. Test'te + normal loglama bozulmaz.
        $exceptions->report(function (Throwable $e): void {
            if (app()->environment('testing')) {
                return;
            }
            // Beklenen (500 olmayan) hataları atla.
            if ($e instanceof ValidationException
                || $e instanceof AuthenticationException
                || $e instanceof AuthorizationException
                || $e instanceof ModelNotFoundException
                || $e instanceof ThrottleRequestsException) {
                return;
            }
            if ($e instanceof HttpExceptionInterface
                && $e->getStatusCode() < 500) {
                return;
            }
            // BEKLENEN + kendiliğinden düzelen analiz (gnubg PR) hataları: AnalyzeMatchPrJob, gnubg
            // geçici erişilemez/degrade iken SAHTE 0.0 yazmamak için BİLEREK fırlatır -> $tries/backoff
            // retry + heal cron temiz rerun'da gerçek PR'ı yazar. Bu SUNUCU HATASI DEĞİL: loglanır ama
            // "cli/queue" 🔴 500 alarmı GÖNDERİLMEZ (deadlock ile aynı mantık). Gerçek 500'ler etkilenmez.
            if ($e instanceof TransientAnalysisException) {
                return;
            }
            // `php artisan tinker` oturumunda girilen hatalı PHP (ör. satır başında `\App\...`) PsySH'in
            // ParseErrorException'ını fırlatır -> "cli/queue" 🔴 500 alarmı spam ediyordu (12 kez, hep
            // elle tinker serilerinde). Psy YALNIZ interaktif tinker'da çalışır (prod istek/kuyruk yolunda
            // ASLA) -> hiçbir Psy exception'ı gerçek SUNUCU HATASI DEĞİL: loglanır ama alarm GÖNDERİLMEZ.
            if ($e instanceof Exception) {
                return;
            }
            // KUYRUK-worker MaxAttemptsExceededException: bir iş worker --timeout'unu aşınca (ör. yavaş
            // gnubg'de warm reviewMatch) ya da sunucu reboot'u işi yarıda bırakıp retry_after sonrası
            // yeniden alınınca framework bunu fırlatır. Bu bir İSTEK 500'ü DEĞİL (yalnız cli/queue'da olur)
            // -> "🔴 Sunucu HATASI (500)" spam'i. Gerçek job hataları ZATEN Queue::failing ile (kendi
            // per-job filtresiyle; best-effort WarmMatchAnalysisJob orada atlanır) alarmlanır -> bu yolda sus.
            if ($e instanceof MaxAttemptsExceededException) {
                return;
            }
            // LIVEWIRE/FILAMENT istemci-kaynaklı "kilitli özellik" ihlali: `/livewire/update`'e gelen
            // BAYAT snapshot (deploy anında admin'in açık Filament sayfası release rotasyonuyla
            // uyumsuz kalır) VEYA endpoint'e bot/tamper isteği @locked bir özelliği güncellemeye
            // çalışınca Livewire bunu GÜVENLİK guard'ı olarak fırlatır. Bu SUNUCU HATASI DEĞİL
            // (düzeltilecek kod yok; sayfa yenileyince geçer) -> loglanır ama "🔴 500" alarmı + Sentry
            // GÖNDERİLMEZ (sahte 500 gürültüsü; 157180076). Gerçek 500'ler etkilenmez.
            if ($e instanceof CannotUpdateLockedPropertyException) {
                return;
            }
            // GEÇİCİ DB kilit hataları (InnoDB deadlock 1213 / lock-wait timeout 1205 / SQLSTATE 40001):
            // database queue sürücüsünde worker'ın `SELECT ... FOR UPDATE` yoklaması ile eşzamanlı
            // job INSERT'i arasında BEKLENEN + kendiliğinden düzelen çakışmadır (kaybeden işlem geri
            // alınır, worker devam eder, iş kaybı YOK). Loglanır ama UYARI (e-posta/WA) GÖNDERİLMEZ
            // -> "cli/queue" 500 spam'i olmaz. Gerçek 500'ler etkilenmez.
            if ($e instanceof QueryException) {
                // MESAJ-tabanlı (kurşun geçirmez): getCode/errorInfo sürüme göre değişebilir; hata
                // metni deadlock imzasını DAİMA taşır ("SQLSTATE[40001] ... 1213 Deadlock ...").
                $m = $e->getMessage();
                if ((string) $e->getCode() === '40001'
                    || str_contains($m, '40001')
                    || str_contains($m, '1213')
                    || str_contains($m, '1205')
                    || str_contains($m, 'Deadlock')
                    || str_contains($m, 'Lock wait timeout')) {
                    return;
                }
            }
            // ELLE çalıştırılan CLI tek-satırlıkları (`php artisan tinker [--execute]`, `php -r '...'`):
            // yanlış kolon sorgusu (users.name yok -> nickname), ağır ad-hoc `->get()` bellek taşması
            // (128M/512M FatalError), yazım hataları (count() int) ... hepsi "cli/queue" 🔴 500 maili
            // atıyordu (hep elle sorgu/araştırma serilerinde). Bunlar UYGULAMA/JOB hatası DEĞİL.
            // Trace'e BAKMA: bellek FatalError'ı hem elle hem gerçek worker OOM'da `#0 {main}` gösterir.
            // KESİN imza argv'de: php -r -> ["Standard input code"]; tinker -> ["artisan","tinker",..].
            // Bu DENYLIST yalnız bu ikisini susturur; GERÇEK queue:work / schedule:run / arka-plan cron /
            // deploy komutları (hepsi kendi argv'siyle koşar) DOKUNULMAZ -> worker OOM alarmı korunur.
            if (app()->runningInConsole()) {
                $argv = implode(' ', (array) ($_SERVER['argv'] ?? []));
                if (str_contains($argv, 'Standard input code') || str_contains($argv, 'tinker')) {
                    return;
                }
            }
            // GERÇEK 500 (tüm beklenen/gürültü filtreleri yukarıda elendi): Sentry'ye gönder.
            // Sentry olayları kendi içinde grup/dedup'lar -> 15dk e-posta/WA spam kapısından ÖNCE
            // çağır ki her gerçek hata Sentry'ye ulaşsın. DSN yoksa 'sentry' bind edilmez -> no-op
            // (yerel/test güvenli; testing zaten en üstte return eder).
            if (app()->bound('sentry')) {
                \Sentry\captureException($e);
            }
            try {
                if (Cache::get('alert:http500:last')) {
                    return; // 15 dk penceresi -> spam bastır
                }
                Cache::put('alert:http500:last', time(), now()->addMinutes(15));
                // Query string room/PAT/reset token'ları alert kanallarına taşınmasın.
                $url = app()->runningInConsole()
                    ? 'cli/queue'
                    : request()->getSchemeAndHttpHost().request()->getPathInfo();
                $error = preg_replace(
                    '/(bearer\s+|(?:token|password|secret|authorization|api_key)=)[^\s&]+/i',
                    '$1[REDACTED]',
                    (string) $e->getMessage()
                ) ?: 'redacted-error';
                Alert::send(
                    '🔴 Sunucu HATASI (500): '.get_class($e)."\n".$error."\nURL: ".$url,
                    'TavlaTV — Sunucu Hatası (500)'
                );
            } catch (Throwable $x) {
                // uyarı mekanizması istek akışını asla bozmasın
            }
        });
    })->create();
