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
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
