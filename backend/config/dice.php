<?php

// Sunucu-otoriter ZAR (para maçı güvenliği, BAĞIMSIZ Faz 1). Hamle/tahta/küp LEGACY kalır.
// Zar SUNUCUDA (commit-reveal) üretilir; update() istemcinin oynadığı zarı sunucunun
// verdiğiyle eşleşmeye zorlar -> istemci zar DEĞERİNİ seçemez.
return [
    // Yeni bahisli (staked) eşleşme odalarında dice_authority'yi aç. Rollout/rollback env ile:
    // false yaparsan yeni odalar zarı yine LEGACY (istemci) üretir (eski davranış).
    'authority' => (bool) env('DICE_AUTHORITY', true),

    // KILL-SWITCH: update()'te zar eşleşmesini ZORLA (uyuşmazsa reddet). false yalnız
    // kontrollü shadow/geri alma için açıkça seçilebilir; güvenli varsayılan fail-closed'dur.
    'enforce' => (bool) env('DICE_ENFORCE', true),
];
