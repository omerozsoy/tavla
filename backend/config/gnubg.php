<?php

// GNU Backgammon analiz servisi (gnubg-service) baglantisi. Servis 127.0.0.1'de, yalniz-ic;
// GNUBG_SECRET systemd unit ile AYNI olmali. Bkz gnubg-service/README.md.
return [
    'url' => env('GNUBG_URL', 'http://127.0.0.1:8092'),
    'secret' => env('GNUBG_SECRET', ''),
    'timeout' => (int) env('GNUBG_TIMEOUT', 20),

    // Servis dosyası (systemd birimi bunu çalıştırır). Admin "Servis Durumu" paneli gnubg KIRMIZI
    // iken bunu inceleyip "symlink kırık / dosya yok" teşhisi verir (bugün yaşanan tavlai->tavlatv
    // symlink sorunu gibi). www-data /opt'u okuyabilir (drwxr-xr-x). Yol farklıysa env ile ayarla.
    'service_file' => env('GNUBG_SERVICE_FILE', '/opt/gnubg-service/gnubg_service.py'),

    // GNU-only PR modu: off | shadow | authoritative.
    //  off           -> hiçbir şey (varsayılan; güvenli).
    //  shadow        -> maç bitince arka planda (queue) gnubg PR hesapla + match_results.gnubg_pr'a
    //                   yaz + client PR ile logla. GÖSTERİLEN/otoriter PR DEĞİŞMEZ.
    //  authoritative -> (ileride) gnubg PR resmi PR olur.
    'pr_mode' => env('GNUBG_PR_MODE', 'off'),

    // AĞIR ANALİZ (reviewmatch/analyzematch/matchluck/selfplay) için AYRI gnubg instance URL'i.
    // Boş/aynı ise TEK instance kullanılır (geriye dönük uyum). Level 11/12 uzun sürebildiği için
    // canlı bot (8092) ile ağır analizi (8093) AYIRMAK, ağır işin canlı botu bloklamasını önler.
    'heavy_url' => env('GNUBG_HEAVY_URL', env('GNUBG_URL', 'http://127.0.0.1:8092')),

    // --- BOT SEVİYE SİSTEMİ (feature flag'ler; deploy'suz kapatma) ------------------------------
    // Level 11 (TavlaTV Grandmaster, 3-ply) ve Level 12 (TavlaTV Ultimate, adaptive 3->4-ply).
    // Kapalıysa istenen seviye 10'a kırpılır (bot yine oynar, sadece 2-ply). Sorun çıkarsa env ile
    // anında kapat + FPM restart.
    'level11_enabled' => (bool) env('GNUBG_LEVEL11_ENABLED', true),
    'level12_enabled' => (bool) env('GNUBG_LEVEL12_ENABLED', true),

    // Level 12 adaptive: 4-ply'a yükseltme eşiği (top-2 equity farkı < eşik -> yakın karar -> derinleş)
    // + toplam bot karar süresi sert duvarı (sn; dolarsa 3-ply sonucu kullanılır) + escalate ply.
    'level12_4ply_threshold' => (float) env('GNUBG_LEVEL12_4PLY_THRESHOLD', 0.040),
    'level12_max_seconds' => (float) env('GNUBG_LEVEL12_MAX_SECONDS', 10),
    'level12_escalate_plies' => (int) env('GNUBG_LEVEL12_ESCALATE_PLIES', 4),

    // Level 11/12 move-filter preset adı (python _MOVEFILTERS: 'normal' | 'large').
    'deep_movefilter' => env('GNUBG_DEEP_MOVEFILTER', 'large'),
];
