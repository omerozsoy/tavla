<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next)
    {
        // $request->user() hem web (session) hem sanctum (API) guard'inda calisir.
        $user = $request->user();
        if (! $user || ! $user->is_admin) {
            // API/JSON istegi -> 403; tarayici (panel) -> giris sayfasina yonlendir.
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Yetkisiz.'], 403);
            }
            return redirect('/panel/login');
        }
        return $next($request);
    }
}
