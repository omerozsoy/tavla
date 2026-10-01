<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Optional auth for guest routes; invalid bearer credentials cannot downgrade to a guest. */
class EnsureActiveAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');
        if ($request->bearerToken() !== null && ! $user) {
            return response()->json(['message' => 'Oturum geçersiz veya süresi dolmuş.'], 401);
        }
        if ($user?->isBanned()) {
            return response()->json(['message' => 'Bu hesapla işlem yapılamaz.'], 403);
        }

        // SLIDING oturum: aktif istekte token son-kullanma tarihini ileri kaydır. Böylece aktif
        // oyuncu (hele turnuvada) ASLA maç ortasında düşmez; yalnız idle_days gün hiç kullanılmayan
        // token Sanctum tarafından geçersiz sayılır. Her istekte DB yazmamak için: kalan ömür
        // (idle-1) günün altına düşünce tazele -> yaklaşık günde 1 yazım (oda poll'u boğmaz).
        $idle = (int) config('sanctum.idle_days', 30);
        $token = $user?->currentAccessToken();
        // Yalnız GERÇEK, veritabanında var olan token'da (TransientToken / test actingAs hariç).
        if ($idle > 0 && $token instanceof \Laravel\Sanctum\PersonalAccessToken && $token->exists) {
            $refreshBelow = now()->addDays(max(1, $idle - 1));
            if (! $token->expires_at || $token->expires_at->lt($refreshBelow)) {
                $token->expires_at = now()->addDays($idle);
                $token->save();
            }
        }

        return $next($request);
    }
}
