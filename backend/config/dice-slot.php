<?php

/**
 * ZAR SLOTU (Dice Slot) — genel yapılandırma.
 *
 * Buradaki değerler VARSAYILAN'dır; admin panelden (Zar Slotu > Ayarlar) canlı olarak
 * değiştirilebilir ve override edilir (Setting modeli, cache'li, 'ds_' önekli). Kod her yerde
 * DiceSlotSettings::x('key') ile okur; kayıt yoksa buradaki fallback kullanılır.
 *
 * KRİTİK: Makara sonuçlarını (3 sembol) DAİMA backend seçer (random_int = CSPRNG). Frontend
 * yalnızca sunucunun seçtiği sembollere makara animasyonu yapar — sonuç değiştirilemez.
 *
 * Semboller: 6 zar yüzü (d1..d6) + özel 64 küpü (c64 = doubling cube -> JACKPOT).
 * Kazanç: aynı üç sembol. Üçlü zar payout tablosundan (küçükten büyüğe); üçlü 64 = ARTAN
 * jackpot havuzu (her spinde büyür, kazanılınca tabana sıfırlanır).
 */

return [
    // Makara sembolleri (kod). Frontend bunları zar/küp olarak çizer.
    'symbols' => ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'c64'],

    // Genel ayar VARSAYILANLARI (admin panelden değiştirilebilir; Setting 'ds_*' anahtarları).
    'defaults' => [
        'enabled' => true,
        'require_login' => true,

        // --- Ekonomi (Şans Çarkı ile aynı mantık) ---
        'free_spins_per_day' => 3,     // günlük ücretsiz çevirme
        'spin_cost' => 50,             // ücretsiz hak bitince coin ile çevirme bedeli (0 = ödemeli çevirme kapalı)
        'cooldown_minutes' => 0,       // 0 = ardışık çevirmede bekleme yok
        'reset_hour' => 0,             // günlük hakların sıfırlandığı saat (yerel)
        'timezone' => 'Europe/Istanbul',

        // --- Sembol ağırlıkları (kazanma olasılığını belirler; RTP kontrolü) ---
        // Her zar yüzü aynı ağırlıkta -> ödül farkı miktardan gelir (klasik slot).
        // 64 küpü daha nadir -> jackpot zor gelir.
        'die_weight' => 100,           // her zar yüzü (1..6) ağırlığı
        'cube_weight' => 34,           // 64 küpü (c64) ağırlığı — nadir

        // --- Üçlü zar ödülleri (coin), küçükten büyüğe ---
        'payout_1' => 100,             // 1-1-1
        'payout_2' => 200,             // 2-2-2
        'payout_3' => 400,             // 3-3-3
        'payout_4' => 800,             // 4-4-4
        'payout_5' => 1500,            // 5-5-5
        'payout_6' => 3000,            // 6-6-6 (en yüksek normal ödül)

        // --- Artan (progressive) jackpot: 64-64-64 ---
        'jackpot_base' => 5000,        // taban/başlangıç havuzu (kazanılınca buraya sıfırlanır)
        'jackpot_increment' => 25,     // her spinde havuza eklenen coin (havuz büyür)
    ],
];
