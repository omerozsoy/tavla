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
    'prices' => [
        'star'    => ['yearly' => 79999, 'monthly' => 7999],
        'starpro' => ['yearly' => 149999, 'monthly' => 14999],
    ],
];
