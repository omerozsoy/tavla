<?php

// Sunucu-otoriter ZAR (para maçı güvenliği, BAĞIMSIZ Faz 1). Hamle/tahta/küp LEGACY kalır.
// Zar SUNUCUDA (commit-reveal) üretilir; update() istemcinin oynadığı zarı sunucunun
// verdiğiyle eşleşmeye zorlar -> istemci zar DEĞERİNİ seçemez.
return [
    // Yeni bahisli (staked) eşleşme odalarında dice_authority'yi aç. Rollout/rollback env ile:
    // false yaparsan yeni odalar zarı yine LEGACY (istemci) üretir (eski davranış).
    'authority' => (bool) env('DICE_AUTHORITY', true),

    // KILL-SWITCH: update()'te zar eşleşmesini ZORLA (uyuşmazsa reddet). false = "shadow":
    // sunucu zarı yine verilir + uyuşmazlık LOGLANIR ama reddedilmez (boru hattını canlıda
    // risksiz doğrula). VARSAYILAN false (gölge): ilk canlı deploy hiçbir maçı kıramaz.
    // Boru hattı doğrulanınca .env'de DICE_ENFORCE=true yap -> hile fiilen engellenir.
    'enforce' => (bool) env('DICE_ENFORCE', false),
];
