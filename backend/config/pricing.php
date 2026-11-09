<?php

// Fiyatlandirma ayarlari. Odeme-saglayicidan BAGIMSIZ; burada tutulur.
// (PayTR kaldirildi -> kart odemesi artik PENDING Payment olusturur, havale gibi elle islenir.)
return [
    'currency' => 'TL',

    // Plan fiyatlari (TRY, kurus cinsinden = TL x 100). Tek tip uyelik "Premium".
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
