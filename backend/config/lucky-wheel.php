<?php

/**
 * ŞANS ÇARKI (Lucky Wheel) — genel yapılandırma.
 *
 * Buradaki değerler VARSAYILAN'dır; admin panelden (Şans Çarkı > Ayarlar) canlı
 * olarak değiştirilebilir ve override edilir (Setting modeli, cache'li). Kod her yerde
 * LuckyWheelSettings::x('key') ile okur; kayıt yoksa buradaki fallback kullanılır.
 *
 * ÖNEMLİ: Dilim sayısı BURADA sabit DEĞİLDİR. Çark, o an geçerli (aktif + tarih
 * aralığında + stokta) ödül sayısı kadar dilim üretir; yalnızca min/max ile sınırlanır.
 */

return [
    // Ödül tipleri (fulfillment RewardFulfillmentService içinde bu tiplere göre dağıtır).
    'types' => [
        'COIN',        // amount kadar coin
        'PREMIUM_DAY', // amount gün premium (plan_until uzatılır)
        'AVATAR',      // reference_id = çerçeve motion id (unlocks[] 'frame.<id>')
        'BOARD_THEME', // reference_id = tahta tema id (unlocks[] 'theme.<id>')
        'BADGE',       // reference_id = achievement slug (AchievementService::unlock)
        'FREE_SPIN',   // amount kadar bonus çevirme hakkı
        'CUSTOM',      // yalnız kayıt/snapshot (elle işlenecek özel ödül)
    ],

    // Genel ayar VARSAYILANLARI (admin panelden değiştirilebilir; Setting 'lw_*' anahtarları).
    'defaults' => [
        'enabled' => true,
        'free_spins_per_day' => 1,
        'spin_cost' => 10,             // ücretsiz/bonus hak bitince coin ile çevirme bedeli (0 = ödemeli çevirme kapalı)
        'min_slice_count' => 4,
        'max_slice_count' => 16,
        'cooldown_minutes' => 0,       // 0 = ardışık çevirme engeli yok (yalnız günlük hak)
        'require_login' => true,
        'animation_duration' => 5000,  // ms (frontend dönüş süresi)
        'show_probability' => false,   // kullanıcıya gerçek yüzdeyi göster
        'reset_hour' => 0,             // günlük hakların sıfırlandığı saat (yerel)
        'timezone' => 'Europe/Istanbul',
    ],

    // Ödül tipi -> Phosphor ikon önerisi (admin ikon seçmezse gösterim fallback'i).
    'type_icons' => [
        'COIN' => 'coins',
        'PREMIUM_DAY' => 'star',
        'AVATAR' => 'user-circle',
        'BOARD_THEME' => 'squares-four',
        'BADGE' => 'medal',
        'FREE_SPIN' => 'arrows-clockwise',
        'CUSTOM' => 'gift',
    ],

    // Varsayılan dilim rengi paleti (admin renk seçmezse sıraya göre atanır).
    // Canlı/festival tonları — sıcak & soğuk dönüşümlü; metin rengi ön yüzde dilim
    // parlaklığına göre otomatik (koyu/açık) seçilir (readableText).
    'palette' => [
        '#e8412e', '#f7b500', '#1fa85c', '#159fd4', '#8e3fd4',
        '#ff7a29', '#e01e5a', '#12b3a6', '#3b6fe0', '#d4409a',
        '#84c318', '#f26419', '#b21fb0', '#06a8cc', '#ffb200', '#5a3fd6',
    ],
];
