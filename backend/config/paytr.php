<?php

// PayTR iframe API ayarlari. Kimlik bilgileri PayTR magaza panelinden gelir; .env'e girilir.
// (Garanti 3D kaldirildi -> kart odemeleri artik PayTR iframe ile.)
return [
    'merchant_id' => env('PAYTR_MERCHANT_ID'),    // Magaza No
    'merchant_key' => env('PAYTR_MERCHANT_KEY'),   // Magaza Parola (HMAC anahtari)
    'merchant_salt' => env('PAYTR_MERCHANT_SALT'),  // Magaza Gizli Anahtar (HMAC tuzu)
    'test_mode' => (bool) env('PAYTR_TEST_MODE', true), // 1 = test karti; canlida 0 yap

    // PayTR get-token + guvenli iframe uclari (sabit).
    'token_url' => 'https://www.paytr.com/odeme/api/get-token',
    'iframe_url' => 'https://www.paytr.com/odeme/guvenli/', // + token
    'currency' => 'TL',
    'timeout' => (int) env('PAYTR_TIMEOUT', 30), // iframe odeme zaman asimi (dk)

    // DEMO odeme modu: PayTR bilgileri GIRILMEDEN akisi gormek/test etmek icin. AKTIFKEN GERCEK
    // PARA CEKILMEZ; iframe sayfasi acilinca odeme dogrudan basarili sayilip coin/uyelik yuklenir.
    // GUVENLIK: demo YALNIZ acikca PAYMENT_DEMO=true ile acilir (APP_DEBUG'dan TUREMEZ) ve
    // production'da ASLA aktif olmaz (bedava coin acigi). PayTR bilgileri girilince (isConfigured())
    // demo zaten devre disi.
    'demo' => env('APP_ENV') === 'production' ? false : (bool) env('PAYMENT_DEMO', false),

    // Plan fiyatlari (TRY, kurus cinsinden = TL x 100). Odeme-saglayicidan BAGIMSIZ; burada tutulur.
    // Tek tip uyelik "Premium": yillik 499,90 TL = 49990 kurus.
    'prices' => [
        'premium' => ['yearly' => 49990, 'monthly' => 4990],
    ],

    // "Üyeliğini Uzat" -> 1 yillik Premium uzatma. KURUS. 499,00 TL = 49900 kurus.
    'renew' => ['yearly' => 49900],

    // Coin (jeton) paketleri — ARTIK OTORITER DEGIL: fiyat/paketler DB `coin_packages` tablosundan
    // (Magaza > Coin Paketleri panelinden) okunur. Bu array yalniz baslangic tohumu/referanstir
    // (bazi testler slug anahtari icin okur). Fiyat degistirmek icin PANELI kullan.
    'coin_packages' => [
        'baslangic' => ['price' => 10000,  'gc' => 100],
        'kese' => ['price' => 47500,  'gc' => 500],
        'sandik' => ['price' => 90000,  'gc' => 1000],
        'hazine' => ['price' => 212500, 'gc' => 2500],
        'kasa' => ['price' => 400000, 'gc' => 5000],
        'servet' => ['price' => 750000, 'gc' => 10000],
    ],
];
