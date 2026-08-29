<?php

// Garanti BBVA Sanal POS (GVP) 3D Secure ayarlari.
// Kimlik bilgileri Garanti uye isyeri sozlesmesinden gelir; .env'e girilir.
return [
    'mode'          => env('GARANTI_MODE', 'TEST'),        // TEST | PROD
    'merchant_id'   => env('GARANTI_MERCHANT_ID'),         // Uye isyeri no
    'terminal_id'   => env('GARANTI_TERMINAL_ID'),         // Terminal no (9 haneye pad'lenir)
    'prov_user'     => env('GARANTI_PROV_USER', 'PROVAUT'),// Provizyon kullanici (genelde PROVAUT)
    'prov_password' => env('GARANTI_PROV_PASSWORD'),       // Provizyon sifresi
    'terminal_user' => env('GARANTI_TERMINAL_USER', 'PROVAUT'),
    'store_key'     => env('GARANTI_STORE_KEY'),           // 3D Secure store key
    'hash_version'  => env('GARANTI_HASH_VERSION', 'v2'),  // v2 = SHA512 (yeni), v1 = SHA1 (eski)

    // Tutar dogrulama sikiligi. Callback'te banka txnamount'u kayitli tutarla (kurus)
    // TAM SAYI olarak karsilastirilir. Banka test'te txnamount'un HER ZAMAN dolu geldigi
    // dogrulandiktan sonra bunu true yap: o zaman bos/uyumsuz tutar odemeyi REDDEDER.
    // Varsayilan false: bos txnamount loglanir ama akis bozulmaz (hash zaten korur).
    'strict_amount' => (bool) env('GARANTI_STRICT_AMOUNT', false),

    'urls' => [
        'TEST' => [
            '3d'        => 'https://sanalposprovtest.garantibbva.com.tr/servlet/gt3dengine',
            'provision' => 'https://sanalposprovtest.garantibbva.com.tr/VPServlet',
        ],
        'PROD' => [
            '3d'        => 'https://sanalposprov.garantibbva.com.tr/servlet/gt3dengine',
            'provision' => 'https://sanalposprov.garantibbva.com.tr/VPServlet',
        ],
    ],

    // Plan fiyatlari (TRY, kurus cinsinden). Kendi fiyatlariniza gore guncelleyin.
    // Tutarlar kurus cinsindendir (TL x 100). Tek tip uyelik "Premium": aylik 200 TL, yillik 2000 TL.
    'prices' => [
        // KURUS (tam sayi). 49,90 TL = 4990 kurus · 499,90 TL = 49990 kurus
        'star'    => ['yearly' => 49990, 'monthly' => 4990],
        'starpro' => ['yearly' => 49990, 'monthly' => 4990], // eski id -> ayni fiyata esitlendi
    ],
];
