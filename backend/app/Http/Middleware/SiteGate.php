<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Site-genelinde "kapali test" sifre kapisi. SITE_PASSWORD .env'de doluysa TUM /api istekleri
// dogru `X-Site-Gate` basligini tasimak zorunda; yoksa 401 {gate:true} doner (controller'a
// GIRMEDEN reddedilir -> APP_DEBUG acikken bile Ignition/hata sayfasi disariya sizmaz).
// SITE_PASSWORD bos ise kapi kapalidir (launch'ta bosalt -> gate otomatik devre disi).
class SiteGate
{
    public function handle(Request $request, Closure $next): Response
    {
        $pw = (string) config('app.site_password', '');
        if ($pw === '') {
            return $next($request); // kapi kapali (sifre tanimsiz)
        }

        $given = (string) $request->header('X-Site-Gate', '');
        if ($given !== '' && hash_equals($pw, $given)) {
            return $next($request);
        }

        return response()->json([
            'gate'    => true,
            'message' => 'Bu ortam geçici olarak kapalı. Devam etmek için erişim şifresi gerekli.',
        ], 401);
    }
}
