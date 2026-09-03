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
];
