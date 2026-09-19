<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => \App\Http\Middleware\EnsureAdmin::class,
        ]);
        // "Kapali test" sifre kapisi: SITE_PASSWORD doluysa tum /api istekleri X-Site-Gate ister.
        // En basta kossun ki reddedilen istek hicbir controller'a/hataya ulasmasin.
        $middleware->prependToGroup('api', \App\Http\Middleware\SiteGate::class);
        // Guvenlik Kalkani izleyicisi: TUM /api isteklerini yanit-sonrasi kaydeder (kim, nerede,
        // kac istek, hata/spin/tarama, risk). Sona eklenir ki auth cozulmus + durum kodu belli olsun.
        $middleware->appendToGroup('api', \App\Http\Middleware\ShieldTracker::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // AKSAMA UYARISI: canlı bir istek SUNUCU HATASI (500) ile patlarsa admin'e e-posta +
        // WhatsApp. Beklenen/istemci hataları (validation 422, auth 401/403, 404, throttle 429)
        // ATLANIR -> yalnız gerçek 500'ler uyarır. 15 dk spam-limit. Test'te + normal loglama bozulmaz.
        $exceptions->report(function (\Throwable $e): void {
            if (app()->environment('testing')) {
                return;
            }
            // Beklenen (500 olmayan) hataları atla.
            if ($e instanceof \Illuminate\Validation\ValidationException
                || $e instanceof \Illuminate\Auth\AuthenticationException
                || $e instanceof \Illuminate\Auth\Access\AuthorizationException
                || $e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException
                || $e instanceof \Illuminate\Http\Exceptions\ThrottleRequestsException) {
                return;
            }
            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface
                && $e->getStatusCode() < 500) {
                return;
            }
            // GEÇİCİ DB kilit hataları (InnoDB deadlock 1213 / lock-wait timeout 1205 / SQLSTATE 40001):
            // database queue sürücüsünde worker'ın `SELECT ... FOR UPDATE` yoklaması ile eşzamanlı
            // job INSERT'i arasında BEKLENEN + kendiliğinden düzelen çakışmadır (kaybeden işlem geri
            // alınır, worker devam eder, iş kaybı YOK). Loglanır ama UYARI (e-posta/WA) GÖNDERİLMEZ
            // -> "cli/queue" 500 spam'i olmaz. Gerçek 500'ler etkilenmez.
            if ($e instanceof \Illuminate\Database\QueryException) {
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
            try {
                if (\Illuminate\Support\Facades\Cache::get('alert:http500:last')) {
                    return; // 15 dk penceresi -> spam bastır
                }
                \Illuminate\Support\Facades\Cache::put('alert:http500:last', time(), now()->addMinutes(15));
                $url = app()->runningInConsole() ? 'cli/queue' : request()->fullUrl();
                \App\Support\Alert::send(
                    "🔴 Sunucu HATASI (500): ".get_class($e)."\n".$e->getMessage()."\nURL: ".$url,
                    'TavlaTV — Sunucu Hatası (500)'
                );
            } catch (\Throwable $x) {
                // uyarı mekanizması istek akışını asla bozmasın
            }
        });
    })->create();
