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

        // --- SONUÇ AĞIRLIKLARI (outcome-first: gerçek slot mantığı) ---
        // Sunucu ÖNCE sonuç kategorisini bu ağırlıklarla seçer, SONRA ona uygun 3 makarayı üretir.
        // Böylece HER kombinasyonun olasılığı BAĞIMSIZ ve doğrudan ayarlanır (net RTP kontrolü):
        //   P(sonuç) = weight / (tüm ağırlıkların toplamı). 'lose_weight' = kazanmayan kombinasyon.
        // Kent (straight) artık zar yüzü ağırlıklarından TÜREMEZ -> KENDİ ağırlığı var (jackpot gibi).
        // Kural: yüksek ödüllü sonuca DÜŞÜK ağırlık ver. Ödemeli çevirmede beklenen değer < spin_cost
        // kalmalı (aksi halde coin BASILIR). Aşağıdaki varsayılanlar spin_cost=50'de ~%76 RTP verir.
        'lose_weight' => 9100,         // kazanmayan sonuç (baskın)
        'triple_weight_1' => 350,      // 1-1-1  (ödül payout_1)
        'triple_weight_2' => 180,      // 2-2-2
        'triple_weight_3' => 90,       // 3-3-3
        'triple_weight_4' => 45,       // 4-4-4
        'triple_weight_5' => 20,       // 5-5-5
        'triple_weight_6' => 9,        // 6-6-6 (en yüksek normal ödül -> en nadir)
        'straight_weight' => 200,      // Kent (ardışık üçlü) — BAĞIMSIZ, nadir (≈%2)
        'jackpot_weight' => 6,         // 64-64-64 (artan jackpot) — çok nadir
        // (ESKİ die_weight_* / cube_weight anahtarları artık KULLANILMIYOR; outcome ağırlıkları geçerli.)

        // --- Üçlü zar ödülleri (coin), küçükten büyüğe ---
        'payout_1' => 100,             // 1-1-1
        'payout_2' => 200,             // 2-2-2
        'payout_3' => 400,             // 3-3-3
        'payout_4' => 800,             // 4-4-4
        'payout_5' => 1500,            // 5-5-5
        'payout_6' => 3000,            // 6-6-6 (en yüksek normal ödül)

        // --- Sıralama / Kent (ardışık üç FARKLI zar, herhangi sırada — poker straight gibi) ---
        // {1,2,3}, {2,3,4}, {3,4,5}, {4,5,6}. 64 küpü dahil DEĞİL. Üçlüden daha sık gelir -> mütevazı.
        'payout_straight' => 150,

        // --- Artan (progressive) jackpot: 64-64-64 ---
        // DİKKAT: jackpot_increment uzun vadede spin başına DOĞRUDAN RTP'ye eklenir
        // (her spin havuza girer, biri kazanınca hepsi ödenir). Yüksek increment = yüksek RTP.
        // spin_cost=50'de increment≈8 -> jackpot katkısı ~%16; toplam RTP ~%68 (güvenli).
        'jackpot_base' => 5000,        // taban/başlangıç havuzu (kazanılınca buraya sıfırlanır)
        'jackpot_increment' => 8,      // her spinde havuza eklenen coin (RTP'ye doğrudan katkı)
    ],
];
