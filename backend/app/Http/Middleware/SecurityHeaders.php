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

        $policy = (string) config('security.csp_report_only_policy');
        if (config('security.csp_enforce', false)) {
            $response->headers->set('Content-Security-Policy', $policy);
        } elseif (config('security.csp_report_only', false)) {
            $response->headers->set('Content-Security-Policy-Report-Only', $policy);
        }

        return $response;
    }
}
