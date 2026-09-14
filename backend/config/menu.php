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

        // --- TURNUVALAR: rekabet + sosyal ---
        ['key' => 'tournaments', 'group' => 'compete', 'label' => 'Online Turnuvalar'],
        ['key' => 'leaderboard', 'group' => 'compete', 'label' => 'Liderlik Tablosu'],
        ['key' => 'friends', 'group' => 'compete', 'label' => 'Arkadaşlar'],

        // --- EGLENCE: sans/ekonomi oyunlari ---
        ['key' => 'luckywheel', 'group' => 'fun', 'label' => 'Şans Çarkı'],
        ['key' => 'diceslot', 'group' => 'fun', 'label' => 'Zar Slotu'],

        // --- KESFET: bilgi / icerik ---
        ['key' => 'calendar', 'group' => 'content', 'label' => 'Turnuva Takvimi'],
        ['key' => 'clubs', 'group' => 'content', 'label' => 'Tavla Kulüpleri'],
        ['key' => 'news', 'group' => 'content', 'label' => 'Haberler'],
        ['key' => 'magazine', 'group' => 'content', 'label' => 'TavlaTV'],

        // --- ARACLAR ---
        ['key' => 'analyzer', 'group' => 'tools', 'label' => 'Pozisyon Analizi'],
        ['key' => 'blunders', 'group' => 'tools', 'label' => 'Hata Günlüğü'],
        ['key' => 'matchHistory', 'group' => 'tools', 'label' => 'Maç Analizleri'],

        // --- HESAP ---
        ['key' => 'membership', 'group' => 'account', 'label' => 'Üyelik'],

        // --- Bilgi (en altta) ---
        ['key' => 'info', 'group' => 'info', 'label' => 'Bilgi'],
    ],

    /*
     * GRUP KATALOGU — sol menu bolum basliklari (admin "Menu Gruplari" ile yonetir).
     * 'key' item'lardaki group ile eslesir; 'label' Turkce VARSAYILAN baslik (bos = basliksiz);
     * 'sort' bolum sirasi. Admin ad/sira/gorunurluk override edebilir + yeni grup ekleyebilir.
     */
    'groups' => [
        ['key' => 'play', 'label' => 'Oyna', 'sort' => 0],
        ['key' => 'compete', 'label' => 'Turnuvalar', 'sort' => 1],
        ['key' => 'fun', 'label' => 'Eğlence', 'sort' => 2],
        ['key' => 'content', 'label' => 'Keşfet', 'sort' => 3],
        ['key' => 'tools', 'label' => 'Araçlar', 'sort' => 4],
        ['key' => 'account', 'label' => 'Hesap', 'sort' => 5],
        ['key' => 'info', 'label' => '', 'sort' => 6], // basliksiz (Bilgi tek oge)
    ],
];
