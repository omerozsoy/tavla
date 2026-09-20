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

        return $next($request);
    }
}
