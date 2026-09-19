<?php

namespace App\Http\Middleware;

use App\Support\Shield;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Güvenlik Kalkanı izleyicisi — 'api' grubuna eklenir.
 *
 * Kayıt işi terminate()'te yapılır: yanıt istemciye GÖNDERİLDİKTEN sonra çalışır, böylece
 * (1) izleme kullanıcının isteğini geciktirmez ve (2) throttle (429), auth (401), 500 gibi
 * exception ile biten istekler bile NİHAİ durum koduyla yakalanır (flood/tarama denemeleri
 * dahil). $request->user() bu aşamada zaten çözülmüştür. İzleme asıl akışı asla bozmaz.
 */
class ShieldTracker
{
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        Shield::record($request, $response->getStatusCode());
    }
}
