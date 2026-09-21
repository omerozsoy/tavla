<?php

return [
    // Report-only is intentionally opt-in until the deployed source inventory is reviewed.
    'csp_report_only' => (bool) env('CSP_REPORT_ONLY', false),
    'csp_report_only_policy' => implode('; ', [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://www.tavlatv.com https://validator.tavlatv.com",
        "frame-src 'self'",
    ]),
];
