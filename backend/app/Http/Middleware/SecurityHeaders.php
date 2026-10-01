<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        // OWASP temel baslikları: clickjacking + MIME-sniff + Adobe cross-domain.
        // X-Frame-Options SAMEORIGIN (DENY degil) -> ayni kaynak iframe'leri kirmaz.
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Permitted-Cross-Domain-Policies', 'none');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        // HSTS yalniz production + https (http uzerinde gondermek anlamsiz/zararli).
        if (app()->environment('production') && $request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // COOP burada SET EDİLMEZ. COOP tek kaynaktan (nginx additional directives) verilir.
        // Birden fazla katman (nginx + .htaccess + middleware) aynı COOP başlığını eklerse tarayıcı
        // çoklu değeri GEÇERSİZ sayar ve GSI "would block the window.postMessage" uyarısı döner.
        // Tek nginx satırı 'same-origin-allow-popups' hem kök '/' hem tüm rotaları kapsar.

        $policy = (string) config('security.csp_report_only_policy');
        if (config('security.csp_enforce', false)) {
            $response->headers->set('Content-Security-Policy', $policy);
        } elseif (config('security.csp_report_only', false)) {
            $response->headers->set('Content-Security-Policy-Report-Only', $policy);
        }

        return $response;
    }
}
