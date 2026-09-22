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

        // Google Sign-In (GSI): accounts.google.com popup/iframe kimlik bilgisini (credential JWT)
        // window.postMessage ile bu sayfaya geri gönderir. COOP ayarlanmazsa/same-origin olursa
        // tarayıcı "Cross-Origin-Opener-Policy policy would block the window.postMessage call"
        // uyarısı verir. 'same-origin-allow-popups' popup'ın opener'a mesaj atmasına izin verirken
        // COOP korumasının çoğunu korur (Google'ın bu uyarı için önerdiği resmî çözüm).
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

        $policy = (string) config('security.csp_report_only_policy');
        if (config('security.csp_enforce', false)) {
            $response->headers->set('Content-Security-Policy', $policy);
        } elseif (config('security.csp_report_only', false)) {
            $response->headers->set('Content-Security-Policy-Report-Only', $policy);
        }

        return $response;
    }
}
