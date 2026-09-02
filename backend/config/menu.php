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
        // --- Oyun baslatma ---
        ['key' => 'solo', 'group' => 'play', 'label' => 'Tek Oyun'],
        ['key' => 'match', 'group' => 'play', 'label' => 'Maç Oyunu'],
        ['key' => 'aiGame', 'group' => 'play', 'label' => 'YZ ile Oyna'],
        ['key' => 'playFriend', 'group' => 'play', 'label' => 'Arkadaşınla Oyna'],

        // --- Rekabet + sosyal ---
        ['key' => 'tournaments', 'group' => 'compete', 'label' => 'Online Turnuvalar'],
        ['key' => 'leaderboard', 'group' => 'compete', 'label' => 'Liderlik Tablosu'],
        ['key' => 'friends', 'group' => 'compete', 'label' => 'Arkadaşlar'],

        // --- Hesap ---
        ['key' => 'membership', 'group' => 'account', 'label' => 'Üyelik'],

        // --- Bilgi / icerik ---
        ['key' => 'calendar', 'group' => 'content', 'label' => 'Turnuva Takvimi'],
        ['key' => 'clubs', 'group' => 'content', 'label' => 'Tavla Kulüpleri'],
        ['key' => 'news', 'group' => 'content', 'label' => 'Haberler'],
        ['key' => 'magazine', 'group' => 'content', 'label' => 'TavlaTV'],

        // --- Araclar ---
        ['key' => 'analyzer', 'group' => 'tools', 'label' => 'Pozisyon Analizi'],
        ['key' => 'blunders', 'group' => 'tools', 'label' => 'Hata Günlüğü'],
        ['key' => 'matchHistory', 'group' => 'tools', 'label' => 'Maç Analizleri'],

        // --- Bilgi (en altta) ---
        ['key' => 'info', 'group' => 'info', 'label' => 'Bilgi'],
    ],
];
