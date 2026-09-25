<?php

// GNU Backgammon analiz servisi (gnubg-service) baglantisi. Servis 127.0.0.1'de, yalniz-ic;
// GNUBG_SECRET systemd unit ile AYNI olmali. Bkz gnubg-service/README.md.
return [
    'url' => env('GNUBG_URL', 'http://127.0.0.1:8092'),
    'secret' => env('GNUBG_SECRET', ''),
    'timeout' => (int) env('GNUBG_TIMEOUT', 20),

    // FAILOVER (kalıcı "—" kalkanı): /analyze için YEDEK instance listesi (virgülle ayrılmış). PR
    // (AnalysisOrchestrator) + canlı bot (BotMoveService) analyze()'ı buradan yedekli çağırır: birincil
    // (url) down/yavaş/restart ise SIRAYLA yedeğe düşer -> PR bir daha boş kalmaz. İKİNCİ gnubg
    // instance'ı (or. :8093 heavy unit) çalıştırıp GNUBG_URL_BACKUP=http://127.0.0.1:8093 ver -> "iki
    // PR sistemi". Boşsa TEK instance (geriye dönük uyum). MoveValidatorService.url_backup ile aynı desen.
    'url_backup' => env('GNUBG_URL_BACKUP', ''),

    // Instance→systemd birim adları (bases SIRASIYLA hizalı: birincil + yedekler). Admin "Servis
    // Durumu" paneli her instance'ı AYRI lamba gösterir + "Yeniden Başlat" doğru birimi hedefler;
    // services:watch her instance'ı ayrı izleyip düşeni kendi birimiyle restart eder. Örn 4 instance:
    // GNUBG_UNITS=gnubg-analysis,gnubg-analysis-heavy,gnubg-analysis-3,gnubg-analysis-4
    // Boşsa yalnız birincil 'gnubg-analysis' bilinir (yedekler için restart SSH komutu gösterilir).
    'units' => env('GNUBG_UNITS', 'gnubg-analysis'),

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
    // BOŞSA (varsayılan) GnuBgClient runtime'da `url`e düşer -> TEK instance (geriye dönük uyum;
    // testler de gnubg.url override'ına uyar). GNUBG_HEAVY_URL=http://127.0.0.1:8093 verilince ağır
    // işler AYRI instance'a gider -> canlı bot (8092) bloklanmaz. Bkz gnubg-service/README.md.
    'heavy_url' => env('GNUBG_HEAVY_URL'),

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
