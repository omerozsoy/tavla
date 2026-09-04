<?php

// Sunucu-otoriter hamle doğrulama servisi (Node validator, para maçı güvenliği Faz 2).
// Servis ayrı bir Node süreci (bkz validator/README.md). Backend her hamleyi buraya sorar.
return [
    // Validator servisinin tabanı (yalnız localhost/iç ağ). Boşsa: aşağıdaki 'required' ile
    // birlikte para/ranked maçta hamle REDDEDİLİR (fail-closed).
    'url' => env('VALIDATOR_URL', ''),

    // Paylaşılan sır (validator VALIDATOR_SECRET ile aynı). x-validator-secret başlığı.
    'secret' => env('VALIDATOR_SECRET', ''),

    // İstek zaman aşımı (sn). Kısa — hamle akışını bloklamasın.
    'timeout' => (float) env('VALIDATOR_TIMEOUT', 3),

    // FAIL-CLOSED: para/ranked maçta validator erişilemezse hamle reddedilir.
    // false yaparsan (yalnız geçiş/dev), validator yoksa doğrulama ATLANIR — GÜVENSİZ.
    'required' => (bool) env('VALIDATOR_REQUIRED', true),

    // TLS doğrulaması. Validator AYNI sunucuda + secret korumalı iç servis olduğundan,
    // subdomain'de geçerli SSL yoksa (Plesk self-signed) doğrulamayı atlamak makul.
    // Let's Encrypt kurulunca true yapabilirsin. Varsayılan false (hemen çalışsın).
    'verify_tls' => filter_var(env('VALIDATOR_VERIFY_TLS', false), FILTER_VALIDATE_BOOL),

    // SUNUCU-OTORİTER PR modu (validator /analyze-pr):
    //   'off'           -> istemci log'undan hesaplanan PR (prFromLog) kullanılır (mevcut davranış).
    //   'shadow'        -> sunucu PR'i AYRICA hesaplanır, istemci PR'iyle FARKI loglanır ama
    //                      KAYDEDİLEN değer hâlâ istemci-türevi (güvenli doğrulama aşaması).
    //   'authoritative' -> sunucu-hesaplı PR KAYDEDİLİR (istemci loss'una güvenilmez). Validator
    //                      erişilemezse prFromLog'a düşer (fail-open; PR istatistik, para değil).
    // Sunucuda 'onnxruntime-node' + modeller şart (bkz build-validator.mjs -> dist/models).
    'pr_mode' => env('VALIDATOR_PR_MODE', 'off'),
];
