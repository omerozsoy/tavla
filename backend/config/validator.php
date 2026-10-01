<?php

// Sunucu-otoriter hamle doğrulama servisi (Node validator, para maçı güvenliği Faz 2).
// Servis ayrı bir Node süreci (bkz validator/README.md). Backend her hamleyi buraya sorar.
return [
    // Validator servisinin tabanı (yalnız localhost/iç ağ). Boşsa: aşağıdaki 'required' ile
    // birlikte para/ranked maçta hamle REDDEDİLİR (fail-closed).
    'url' => env('VALIDATOR_URL', ''),

    // YEDEK (failover) validator taban(lar)ı: birincil (url) erişilemez/5xx olunca SIRAYLA denenir.
    // Validator stateless -> ikinci bir Node örneğini BAŞKA portta koştur, buraya yaz. Böylece tek
    // örnek düşse de otoriter maç DONMAZ (fail-closed yalnız HEPSİ düşerse). Virgülle çok yedek:
    //   VALIDATOR_URL_BACKUP=http://127.0.0.1:8091,http://127.0.0.1:8092
    'url_backup' => env('VALIDATOR_URL_BACKUP', ''),

    // AĞIR ANALİZ İZOLASYONU (anlık yavaşlık fix): /analyze-pr sinir ağı çalıştırır (≤20sn) ve
    // Node TEK event-loop'tur -> aynı instance'a düşen bir PR analizi o instance'ın /validate'ini
    // (canlı HAMLELERİ) saniyelerce BLOKLAR [[gonderiliyor-haksiz-afk-inflight-kalkani]]. Ağır işi
    // ADANMIŞ bir Node örneğine (ör. :8098) ayır: analyzePr yalnız buraya gider, /validate
    // instance'ları PR'dan arınır. BOŞSA otomatik olarak normal url(+backup) listesine düşer
    // (davranış değişmez) -> adanmış instance kurulana kadar güvenli. Virgülle çok yedek.
    //   VALIDATOR_HEAVY_URL=http://127.0.0.1:8098
    //   VALIDATOR_HEAVY_URL_BACKUP=http://127.0.0.1:8099
    'heavy_url' => env('VALIDATOR_HEAVY_URL', ''),
    'heavy_url_backup' => env('VALIDATOR_HEAVY_URL_BACKUP', ''),

    // Paylaşılan sır (validator VALIDATOR_SECRET ile aynı). x-validator-secret başlığı.
    'secret' => env('VALIDATOR_SECRET', ''),

    // İstek zaman aşımı (sn). Kısa — hamle akışını bloklamasın.
    'timeout' => (float) env('VALIDATOR_TIMEOUT', 3),

    // FAIL-CLOSED: para/ranked maçta validator erişilemezse hamle reddedilir.
    // false yaparsan (yalnız geçiş/dev), validator yoksa doğrulama ATLANIR — GÜVENSİZ.
    'required' => (bool) env('VALIDATOR_REQUIRED', true),

    // TLS doğrulaması. Validator AYNI sunucuda + secret korumalı iç servis olduğundan,
    // subdomain'de geçerli SSL yoksa (Plesk self-signed) doğrulamayı atlamak makul.
    // Let's Encrypt kurulunca true yapabilirsin. Varsayılan false (hemen çalışsın).
    // Uzak validator HTTPS ise sertifika doğrulaması varsayılan olarak açık olmalı.
    'verify_tls' => filter_var(env('VALIDATOR_VERIFY_TLS', true), FILTER_VALIDATE_BOOL),

    // SUNUCU-OTORİTER PR modu (validator /analyze-pr):
    //   'off'           -> istemci log'undan hesaplanan PR (prFromLog) kullanılır (mevcut davranış).
    //   'shadow'        -> sunucu PR'i AYRICA hesaplanır, istemci PR'iyle FARKI loglanır ama
    //                      KAYDEDİLEN değer hâlâ istemci-türevi (güvenli doğrulama aşaması).
    //   'authoritative' -> sunucu-hesaplı PR KAYDEDİLİR (istemci loss'una güvenilmez). Validator
    //                      erişilemezse prFromLog'a düşer (fail-open; PR istatistik, para değil).
    // Sunucuda 'onnxruntime-node' + modeller şart (bkz build-validator.mjs -> dist/models).
    'pr_mode' => env('VALIDATOR_PR_MODE', 'off'),

    // OTOMATİK KURTARMA: validator:watch düşüş görünce Passenger'ın restart dosyasına DOKUNUR
    // -> app yeniden başlar (süreç ÇÖKMÜŞken bile; Passenger dosyayı okur, Node koduna bağlı DEĞİL).
    // Yol = validator app kökü + /tmp/restart.txt. Örn Plesk: /var/www/vhosts/tavlatv.com/httpdocs/
    // validator/tmp/restart.txt. Boşsa yalnız /restart ucu denenir (servis ayaktaysa işe yarar).
    'restart_file' => env('VALIDATOR_RESTART_FILE', ''),
];
