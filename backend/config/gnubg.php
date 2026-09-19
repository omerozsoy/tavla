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
];
