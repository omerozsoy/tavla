<?php

// Oyun sunucu-otoritesi (para maçı güvenliği Faz 2). TAM otoriter: zar+hamle+tahta+skor+küp
// SUNUCUDA. Faz 1 (yalnız zar, dice_authority) yerine geçer.
return [
    // Faz 2 tam otorite: AÇIK ise yeni bahisli (staked) eşleşme odaları authoritative=true olur
    // → istemci server_state uygular, her hamle Node validator'da doğrulanır, skor+küp sunucuda.
    // VARSAYILAN KAPALI (dormant): önce validator ayakta + 2-istemci staging + frontend (Adım E)
    // tamam olmalı; ayrıca açılış/başlayan (Adım C) ve Crawford eksikleri kapanmalı. Rollback = env.
    'server_authoritative' => (bool) env('SERVER_AUTHORITATIVE', false),

    // TEST allow-list: GLOBAL kapalıyken bile, SADECE bu user id'lerin İKİSİ de eşleşirse
    // o oda authoritative olur; başka hiçbir maç etkilenmez. Frontend DRAFT'ı 2 hesapla
    // güvenle test etmek için. Kendi + test hesabının id'sini koy. Örn:
    //   SERVER_AUTHORITATIVE_USERS=10,20
    'authoritative_users' => array_values(array_filter(array_map(
        'intval',
        explode(',', (string) env('SERVER_AUTHORITATIVE_USERS', '')),
    ))),
];
