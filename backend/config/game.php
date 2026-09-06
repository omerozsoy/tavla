<?php

// Oyun sunucu-otoritesi (para maçı güvenliği Faz 2). TAM otoriter: zar+hamle+tahta+skor+küp
// SUNUCUDA. Faz 1 (yalnız zar, dice_authority) yerine geçer.
return [
    // Faz 2 tam otorite: AÇIK ise TÜM yeni eşleşme odaları (bahisli + ücretsiz/arkadaşlık)
    // authoritative=true olur → istemci server_state uygular, her hamle Node validator'da
    // doğrulanır, skor+küp sunucuda. (Bahis ayrımı KALDIRILDI — direktif: herkes test etsin.)
    // VARSAYILAN KAPALI: açmadan önce Node validator ayakta olmalı (VALIDATOR_URL/SECRET); PR'ı da
    // otoriter istersen VALIDATOR_PR_MODE. Rollback = env false + config:clear + FPM restart.
    'server_authoritative' => (bool) env('SERVER_AUTHORITATIVE', false),

    // TEST allow-list: GLOBAL kapalıyken bile, SADECE bu user id'lerin İKİSİ de eşleşirse
    // o oda authoritative olur; başka hiçbir maç etkilenmez. Frontend DRAFT'ı 2 hesapla
    // güvenle test etmek için. Kendi + test hesabının id'sini koy. Örn:
    //   SERVER_AUTHORITATIVE_USERS=10,20
    'authoritative_users' => array_values(array_filter(array_map(
        'intval',
        explode(',', (string) env('SERVER_AUTHORITATIVE_USERS', '')),
    ))),

    // KOMISYON (rake): bahisli maç settle'ında platform payı (%). Kazanan stake × (1 − oran) alır;
    // fark commissions ledger'ına kaydedilir (kimseye kredi edilmez). 0 = kapalı (sıfır-toplam).
    // Galaxy ≈ %15; biz %10. 0..90 aralığına kırpılır. Değişiklik: env + config:clear + FPM restart.
    'commission_pct' => max(0, min(90, (int) env('COMMISSION_PCT', 10))),
];
