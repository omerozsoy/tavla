<?php

// GNU Backgammon analiz servisi (gnubg-service) baglantisi. Servis 127.0.0.1'de, yalniz-ic;
// GNUBG_SECRET systemd unit ile AYNI olmali. Bkz gnubg-service/README.md.
return [
    'url' => env('GNUBG_URL', 'http://127.0.0.1:8092'),
    'secret' => env('GNUBG_SECRET', ''),
    'timeout' => (int) env('GNUBG_TIMEOUT', 20),
];
