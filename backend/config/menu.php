<?php

/**
 * SOL MENU KATALOGU — frontend src/pages.ts ile SENKRON tutulur.
 *
 * Her giris bir menu sayfasidir: 'key' pages.ts'teki anahtarla birebir ayni olmali;
 * 'group' divider gruplamasi; 'label' admin tablosunda gorunen Turkce VARSAYILAN ad
 * (sadece goruntuleme icin — DB'ye yazilmaz, i18n cevirisi esas kalir).
 *
 * Yeni bir menu sayfasi eklerken: pages.ts'e satir ekle + buraya da ekle. Admin
 * "Sol Menu" sayfasini acinca MenuItem::syncCatalog() eksik anahtarlar icin satir olusturur.
 */
return [
    'items' => [
        // --- OYNA: oyun baslatma ---
        ['key' => 'solo', 'group' => 'play', 'label' => 'Tek Oyun'],
        ['key' => 'match', 'group' => 'play', 'label' => 'Maç Oyunu'],
        ['key' => 'aiGame', 'group' => 'play', 'label' => 'YZ ile Oyna'],
        ['key' => 'playFriend', 'group' => 'play', 'label' => 'Arkadaşınla Oyna'],

        // --- KLASIK TAVLA OYNA: ayri ana dal (kup yok + mars=2) ---
        ['key' => 'klassikFriend', 'group' => 'klassik', 'label' => 'Klasik Arkadaşınla Oyna'],
        ['key' => 'klassikAi', 'group' => 'klassik', 'label' => 'Klasik Yapay Zeka'],

        // --- TURNUVALAR: rekabet + sosyal ---
        ['key' => 'tournaments', 'group' => 'compete', 'label' => 'Online Turnuvalar'],
        ['key' => 'leaderboard', 'group' => 'compete', 'label' => 'Liderlik Tablosu'],
        ['key' => 'friends', 'group' => 'compete', 'label' => 'Arkadaşlar'],
        ['key' => 'messages', 'group' => 'compete', 'label' => 'Mesajlar'],

        // --- EGLENCE: sans/ekonomi oyunlari ---
        ['key' => 'luckywheel', 'group' => 'fun', 'label' => 'Şans Çarkı'],
        ['key' => 'diceslot', 'group' => 'fun', 'label' => 'Zar Slotu'],
        ['key' => 'excuses', 'group' => 'fun', 'label' => 'Bahane Makinesi'],

        // --- KESFET: bilgi / icerik ---
        ['key' => 'calendar', 'group' => 'content', 'label' => 'Turnuva Takvimi'],
        ['key' => 'clubs', 'group' => 'content', 'label' => 'Tavla Kulüpleri'],
        ['key' => 'news', 'group' => 'content', 'label' => 'Haberler'],
        ['key' => 'magazine', 'group' => 'content', 'label' => 'TavlaTV'],

        // --- ARACLAR ---
        ['key' => 'analyzer', 'group' => 'tools', 'label' => 'Pozisyon Analizi'],
        ['key' => 'matAnalyzer', 'group' => 'tools', 'label' => 'Mat Analiz'],
        ['key' => 'blunders', 'group' => 'tools', 'label' => 'Hata Günlüğü'],
        ['key' => 'matchHistory', 'group' => 'tools', 'label' => 'Maç Analizleri'],

        // --- HESAP ---
        ['key' => 'membership', 'group' => 'account', 'label' => 'Üyelik'],
        ['key' => 'shop', 'group' => 'account', 'label' => 'Mağaza'],

        // --- BİLGİ: tek tek alt sayfalar (tek "Bilgi" ogesi yerine) ---
        ['key' => 'info-about', 'group' => 'info', 'label' => 'Hakkımızda'],
        ['key' => 'info-services', 'group' => 'info', 'label' => 'Hizmetler'],
        ['key' => 'info-glossary', 'group' => 'info', 'label' => 'Sözlük'],
        ['key' => 'info-ranks', 'group' => 'info', 'label' => 'Rütbeler'],
        ['key' => 'info-scoring', 'group' => 'info', 'label' => 'Puanlama'],
        ['key' => 'info-badges', 'group' => 'info', 'label' => 'Rozetler'],
        ['key' => 'info-fair', 'group' => 'info', 'label' => 'Adil Zar'],
    ],

    /*
     * GRUP KATALOGU — sol menu bolum basliklari (admin "Menu Gruplari" ile yonetir).
     * 'key' item'lardaki group ile eslesir; 'label' Turkce VARSAYILAN baslik (bos = basliksiz);
     * 'sort' bolum sirasi. Admin ad/sira/gorunurluk override edebilir + yeni grup ekleyebilir.
     */
    // 'collapsed' => grup menude KATLI (kapali) baslar mi (admin override edebilir).
    'groups' => [
        // Modern once, Klasik hemen sonra; sonra digerleri. Sort EXPLICIT (tie yok) ki
        // fresh seed'de de sira net olsun (prod'da admin override eder; syncCatalog mevcut
        // satirlari EZMEZ -> bu degerler yalniz eksik anahtar ilk eklendiginde gecerli).
        ['key' => 'play', 'label' => 'Modern Tavla Oyna', 'sort' => 0, 'collapsed' => false],
        ['key' => 'klassik', 'label' => 'Klasik Tavla Oyna', 'sort' => 1, 'collapsed' => false],
        ['key' => 'compete', 'label' => 'Turnuvalar', 'sort' => 2, 'collapsed' => false],
        ['key' => 'fun', 'label' => 'Eğlence', 'sort' => 3, 'collapsed' => true],
        ['key' => 'content', 'label' => 'Keşfet', 'sort' => 4, 'collapsed' => true],
        ['key' => 'tools', 'label' => 'Araçlar', 'sort' => 5, 'collapsed' => true],
        ['key' => 'account', 'label' => 'Hesap', 'sort' => 6, 'collapsed' => true],
        ['key' => 'info', 'label' => 'Bilgi', 'sort' => 7, 'collapsed' => true],
    ],
];
