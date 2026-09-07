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
    'palette' => [
        '#a83a2b', '#e6b422', '#2f6f4f', '#1f5673', '#6e3b8a',
        '#c85a3c', '#3a7d99', '#8a6d3b', '#4a4e69', '#b5651d',
        '#2a9d8f', '#9c2c2c', '#5f7161', '#7d4f9c', '#d08c34', '#264653',
    ],
];
