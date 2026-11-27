<?php

// Fotograftan pozisyon tanima servisi (recognition/service.py) baglantisi. Servis 127.0.0.1'de,
// yalniz-ic; RECOG_SECRET systemd/Forge-daemon unit ile AYNI olmali. Bkz recognition/README.md.
// gnubg-service'ten AYRI: tanima yalniz foto->yapisal konum; gnubg analizi GnuBgClient ile.
return [
    'url' => env('RECOG_URL', 'http://127.0.0.1:8095'),
    'secret' => env('RECOG_SECRET', ''),
    'timeout' => (int) env('RECOG_TIMEOUT', 30),  // tflite cikarim ~1-3sn + aktarim
];
