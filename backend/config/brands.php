<?php

/*
|--------------------------------------------------------------------------
| Çoklu marka / çoklu domain (TEK kod tabanı + TEK veritabanı)
|--------------------------------------------------------------------------
| tavlatv.com  -> Türkçe, "TavlaTv" markası
| gammontv.com -> İngilizce, "GammonTV" markası
|
| İki domain AYNI uygulamayı, veritabanını, kullanıcıları, oyunları, lobileri
| ve turnuvaları paylaşır (App\Support\Brand::fromHost ile istenen host'a göre
| yalnız DİL + MARKA sunumu değişir). Origin değerleri ENV ile geçersiz
| kılınabilir; böylece staging/alan-adı değişiklikleri koda dokunmadan yapılır.
*/

return [
    // Host eşleşmezse (CLI, bilinmeyen host) kullanılacak marka.
    'default' => env('BRAND_DEFAULT', 'tavla'),

    // host içinde geçen alt-dize => marka anahtarı. İlk eşleşen kazanır.
    // (www./apex/staging hepsini tek kuralla yakalar: "gammontv" tüm gammontv.* host'larına uyar.)
    'hosts' => [
        'gammontv' => 'gammon',
        'tavlatv' => 'tavla',
    ],

    'brands' => [
        'tavla' => [
            'name' => 'TavlaTv',
            'locale' => 'tr',
            'og_locale' => 'tr_TR',
            'origin' => env('TAVLA_ORIGIN', 'https://www.tavlatv.com'),
            'manifest' => '/manifest.webmanifest',
            'og_image' => '/og-image.jpg',
            // E-posta gönderen adresi (Resend'de doğrulanmış domain). Boşsa MAIL_FROM_ADDRESS.
            'mail_from' => env('TAVLA_MAIL_FROM'),
            // E-posta üst logosu (public kök yolu). Boşsa şablon metin wordmark'a düşer.
            'email_logo' => env('TAVLA_EMAIL_LOGO', '/email-logo.png'),
            // E-posta footer sloganı (markaya özel).
            'email_tagline' => 'Türkiye\'nin Tavla Portalı',
        ],
        'gammon' => [
            'name' => 'GammonTV',
            'locale' => 'en',
            'og_locale' => 'en_US',
            'origin' => env('GAMMON_ORIGIN', 'https://www.gammontv.com'),
            'manifest' => '/manifest.en.webmanifest',
            'og_image' => '/og-image.jpg', // ponytail: şimdilik ortak görsel; gammon kendi OG'sini ekleyince override et
            'mail_from' => env('GAMMON_MAIL_FROM'), // gammontv.com Resend'de doğrulanınca set edilir
            // GammonTV e-posta logosu henüz yok: dosya (/gammontv-email-logo.png) eklenip GAMMON_EMAIL_LOGO
            // set edilene kadar null kalır -> şablon "GammonTV" metin wordmark'ına düşer (tasarım uydurma yok).
            'email_logo' => env('GAMMON_EMAIL_LOGO'),
            'email_tagline' => 'Play Backgammon Online',
        ],
    ],
];
