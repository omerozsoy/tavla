<?php

return [
    // Enforcing is opt-in until the deployed source inventory is reviewed.
    'csp_enforce' => (bool) env('CSP_ENFORCE', false),
    'csp_report_only' => (bool) env('CSP_REPORT_ONLY', false),
    'csp_report_only_policy' => implode('; ', [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        // Filament FileUpload (FilePond) resim önizlemesini blob web worker ile üretir;
        // worker-src yoksa default-src 'self'e düşer, blob: worker bloklanır -> panelde galeri
        // görselleri gri kutu kalır. onnxruntime-web thread worker'ı için de gerekli.
        "worker-src 'self' blob:",
        // 'wasm-unsafe-eval': wildbg sinir ağı (onnxruntime-web) WebAssembly derler; Firefox/Chrome
        // bunu script-src'ta 'wasm-unsafe-eval' (veya daha geniş 'unsafe-eval') olmadan İHLAL sayar
        // (Report-Only'de konsol hatası; CSP zorunlu olursa motor HİÇ yüklenmez). 'wasm-unsafe-eval'
        // yalnız WebAssembly derlemeye izin verir, JS eval()'a DEĞİL -> WASM için güvenli seçim.
        "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://accounts.google.com https://www.googletagmanager.com https://www.google-analytics.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        // Google Etiketi (gtag/Ads dönüşüm) beacon/collect uçları -> connect-src'e eklendi (aksi halde
        // CSP enforce iken dönüşüm ölçümü bloklanır). .htaccess CSP ile senkron.
        "connect-src 'self' https://www.tavlatv.com https://validator.tavlatv.com https://accounts.google.com https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://googleads.g.doubleclick.net https://www.google.com",
        // Google Sign-In (GSI) One Tap/buton iframe'i accounts.google.com'dan yüklenir -> frame-src şart.
        // td.doubleclick.net = Google Ads dönüşüm linker gizli iframe'i.
        "frame-src 'self' https://accounts.google.com https://td.doubleclick.net",
    ]),
];
