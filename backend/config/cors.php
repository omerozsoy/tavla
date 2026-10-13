<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Production'da wildcard yerine yalnızca izinli frontend origin'leri kullan. Çoklu-domain:
    // iki markanın www+apex origin'leri açık listeyle sınırlı. SPA /api'yi aynı-origin çağırdığı
    // için CORS çoğu akışta tetiklenmez; bu liste cross-origin güvenlik ağıdır.
    // Virgülle ayrılmış liste: CORS_ALLOWED_ORIGINS=https://www.tavlatv.com,https://www.gammontv.com,...
    'allowed_origins' => array_values(array_filter(array_map(
        static fn (string $origin): string => trim($origin),
        explode(',', (string) env(
            'CORS_ALLOWED_ORIGINS',
            'https://www.tavlatv.com,https://tavlatv.com,https://www.gammontv.com,https://gammontv.com,http://localhost:5173'
        ))
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
