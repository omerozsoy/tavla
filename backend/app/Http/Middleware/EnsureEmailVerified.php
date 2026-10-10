<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// E-posta dogrulama ZORUNLU: girisli ama e-postasi dogrulanmamis kullanici oyun/para eylemi
// YAPAMAZ (403). Frontend EmailGate duvarinin API backstop'u -> dogrudan istekle bypass engellenir.
// Misafir (user yok) burada ELENMEZ (ayri politika: oyun uclari auth:sanctum ile ayrica korunur).
class EnsureEmailVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');
        if ($user && ! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'E-posta adresinizi doğrulamadan bu işlemi yapamazsınız.',
                'email_unverified' => true,
            ], 403);
        }

        return $next($request);
    }
}
