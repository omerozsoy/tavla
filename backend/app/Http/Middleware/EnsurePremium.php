<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * PREMIUM-only uçlar için sunucu tarafı kapısı (defense-in-depth). Frontend menü/route
 * zaten free kullanıcıyı üyelik ekranına yönlendirir; bu middleware API'nin doğrudan
 * çağrılmasını (bypass) kapatır. Kapsam: Pozisyon Analizi, Mat Analiz, Hata Günlüğü,
 * Maç Analizleri (derin gnubg incelemesi), Online Turnuvalara katılım.
 *
 * plan_active accessor: süresi geçerli ücretli plan -> 'star'; aksi 'free'. Bu grup
 * 'auth:sanctum' arkasında olduğundan user daima vardır; yine de null-güvenli tutarız.
 */
class EnsurePremium
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');
        if (! $user || $user->plan_active === 'free') {
            return response()->json([
                'message' => 'Bu özellik Premium üyelere özeldir.',
                'code' => 'premium_required',
            ], 403);
        }

        return $next($request);
    }
}
