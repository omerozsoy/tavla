<?php

/**
 * BASARIM (ACHIEVEMENT) KATALOGU — tek kaynak, config-driven.
 * Yeni bir basarim eklemek icin buraya bir dizi girisi eklemek YETER (kod degistirmeden).
 *
 * Her giris:
 *   slug        benzersiz kimlik (user_achievements.achievement_slug ile eslesir)
 *   category    match|wins|streak|tavla|dice|analysis|cube|coin|tournament|rating|social|fun|hidden
 *   name        TR baslik
 *   desc        TR aciklama / nasil alinir
 *   icon        Icon.tsx adi (medal|trophy|crown|star|dice|target|flame|gift...)
 *   tier        bronze|silver|gold|diamond|null
 *   rarity      gorsel varsayilan (common..mythic) — runtime gercek unlock orani ile override edilir
 *   reward_coin unlock'ta verilecek coin (idempotent)
 *   hidden      true ise sart aciklanmaz, '???' gosterilir (unlock olunca acilir)
 *   type        'threshold' (metric >= value) | 'event' (context bayragi true)
 *   metric      threshold: MetricResolver metrigi | event: MatchContext bayrak adi
 *   value       threshold hedefi (event icin 1)
 *
 * Esik/oran degerleri asagidaki 'thresholds' ve 'rarity_bands' altinda (koda gomulu degil).
 */

// ---- Kademe (tier) varsayilanlari: coin odulu + gorsel rarity ----
$TIER = [
    'bronze'  => ['coin' => 100,  'rarity' => 'common'],
    'silver'  => ['coin' => 300,  'rarity' => 'uncommon'],
    'gold'    => ['coin' => 750,  'rarity' => 'rare'],
    'diamond' => ['coin' => 2000, 'rarity' => 'epic'],
];

/**
 * Kademeli aile uretici: ayni metrigin artan esiklerini rozetlere cevirir.
 * $steps: [ [value, tier, name, desc], ... ]
 */
$fam = function (string $prefix, string $category, string $icon, string $metric, array $steps) use ($TIER): array {
    $out = [];
    foreach ($steps as $i => [$value, $tier, $name, $desc]) {
        $out[] = [
            'slug' => $prefix.'_'.($i + 1),
            'category' => $category,
            'name' => $name,
            'desc' => $desc,
            'icon' => $icon,
            'tier' => $tier,
            'rarity' => $TIER[$tier]['rarity'],
            'reward_coin' => $TIER[$tier]['coin'],
            'hidden' => false,
            'type' => 'threshold',
            'metric' => $metric,
            'value' => $value,
        ];
    }
    return $out;
};

/** Tekil event/gizli rozet kisayolu. */
$ev = function (string $slug, string $category, string $name, string $desc, string $icon, string $metric, string $rarity = 'rare', int $coin = 500, bool $hidden = false): array {
    return [
        'slug' => $slug, 'category' => $category, 'name' => $name, 'desc' => $desc,
        'icon' => $icon, 'tier' => null, 'rarity' => $rarity, 'reward_coin' => $coin,
        'hidden' => $hidden, 'type' => 'event', 'metric' => $metric, 'value' => 1,
    ];
};

$list = [];

// ============ MAÇ SAYISI ============
$list = array_merge($list, $fam('match', 'match', 'dice', 'total_matches', [
    [10,    'bronze',  'Çaylak',          '10 maç oyna.'],
    [50,    'bronze',  'Hevesli',         '50 maç oyna.'],
    [100,   'silver',  'Müdavim',         '100 maç oyna.'],
    [500,   'silver',  'Tahta Dostu',     '500 maç oyna.'],
    [1000,  'gold',    'Tahta Eskisi',    '1.000 maç oyna.'],
    [2500,  'gold',    'Kronikleşti',     '2.500 maç oyna.'],
    [5000,  'diamond', 'Yaşayan Efsane',  '5.000 maç oyna.'],
    [10000, 'diamond', 'Tavla Bağımlısı', '10.000 maç oyna.'],
]));

// ============ GALİBİYET ============
$list = array_merge($list, $fam('wins', 'wins', 'trophy', 'total_wins', [
    [1,     'bronze',  'İlk Galibiyet',  'İlk maçını kazan.'],
    [10,    'bronze',  'İlk Zafer',      '10 galibiyet elde et.'],
    [50,    'silver',  'Yükseliş',       '50 galibiyet elde et.'],
    [100,   'silver',  'Kazanan',        '100 galibiyet elde et.'],
    [500,   'gold',    'Usta Kazanan',   '500 galibiyet elde et.'],
    [1000,  'gold',    'Tavla Canavarı', '1.000 galibiyet elde et.'],
    [5000,  'diamond', 'Yenilmez',       '5.000 galibiyet elde et.'],
    [10000, 'diamond', 'Ölümsüz',        '10.000 galibiyet elde et.'],
]));

// ============ GALİBİYET SERİSİ ============
$list = array_merge($list, $fam('streak', 'streak', 'flame', 'best_win_streak', [
    [3,  'bronze',  'Seri Başladı',   'Üst üste 3 maç kazan.'],
    [5,  'bronze',  'Alev Aldı',      'Üst üste 5 maç kazan.'],
    [10, 'silver',  'Durdurulamıyor', 'Üst üste 10 maç kazan.'],
    [20, 'gold',    'Kim Tutar Seni?','Üst üste 20 maç kazan.'],
    [30, 'gold',    'Makine',         'Üst üste 30 maç kazan.'],
    [50, 'diamond', 'Dokunulmaz',     'Üst üste 50 maç kazan.'],
]));

// ============ TAVLA / MARS ============
$list = array_merge($list, $fam('gammon', 'tavla', 'target', 'total_gammons', [
    [1,    'bronze',  'Marslı',        'İlk kez rakibini marsla (gammon) yen.'],
    [10,   'silver',  'Mars Avcısı',   '10 mars galibiyeti elde et.'],
    [100,  'gold',    'Mars Fatihi',   '100 mars galibiyeti elde et.'],
    [1000, 'diamond', 'Mars İmparatoru','1.000 mars galibiyeti elde et.'],
]));
$list = array_merge($list, $fam('backgammon', 'tavla', 'target', 'total_backgammons', [
    [1,   'silver',  'Katmerli',       'İlk kez katmerli marsla (backgammon) yen.'],
    [10,  'gold',    'Acımasız',       '10 katmerli mars galibiyeti elde et.'],
    [100, 'diamond', 'İnfazcı',        '100 katmerli mars galibiyeti elde et.'],
]));
$list[] = $ev('tavla_katmerli_win', 'tavla', 'Acımadı', 'Rakibini katmerli marsla yen.', 'target', 'flag_backgammon_win', 'rare', 400);
$list[] = $ev('tavla_prime6', 'tavla', 'Kapıcı', 'Bir oyunda 6’lı tam kapı (prime) oluştur.', 'target', 'flag_prime6', 'epic', 750);
$list[] = $ev('tavla_comeback', 'tavla', 'Eve Dönüş', 'Çok geriden gelerek maçı kazan.', 'flame', 'flag_comeback', 'epic', 750);
$list[] = $ev('tavla_closeout', 'tavla', 'Çıkabilirsen Çık', 'Rakip barda pul tutarken kapalı bir home board kur.', 'target', 'flag_closeout', 'rare', 400);

// ============ ZAR ============
$list[] = $ev('dice_first_66', 'dice', 'Düşeş!', 'İlk 6-6’nı at.', 'dice', 'flag_first_66', 'common', 100);
$list[] = $ev('dice_first_22', 'dice', 'Dubara', 'İlk 2-2’ni at.', 'dice', 'flag_first_22', 'common', 100);
$list[] = $ev('dice_five_doubles', 'dice', 'Bugün Zarlar Benden Yana', 'Tek maçta 5 veya daha fazla çift zar at.', 'dice', 'flag_five_doubles', 'rare', 400);
$list[] = $ev('dice_win_low_luck', 'dice', 'Zarlar Utansın', 'Çok kötü şans değerine rağmen maçı kazan.', 'dice', 'flag_win_low_luck', 'epic', 600);
$list[] = $ev('dice_win_high_luck', 'dice', 'Şans mı Dediniz?', 'Çok yüksek şansla maçı kazan.', 'dice', 'flag_win_high_luck', 'uncommon', 250);
$list = array_merge($list, $fam('doubles', 'dice', 'dice', 'total_doubles', [
    [10,   'bronze',  'Zar Isındı',       '10 çift zar at.'],
    [100,  'silver',  'Dubleci',          '100 çift zar at.'],
    [1000, 'gold',    'Zarların Efendisi','1.000 çift zar at.'],
    [5000, 'diamond', 'Zar Kâhini',       '5.000 çift zar at.'],
]));

// ============ AI ANALİZ / YETENEK ============
$list = array_merge($list, $fam('analysis', 'analysis', 'star', 'analysis_count', [
    [1,   'bronze',  'Öğrenci',        'İlk maç analizini yap.'],
    [10,  'bronze',  'Dikkatli Oyuncu','10 maç analizi biriktir.'],
    [50,  'silver',  'Meraklı',        '50 maç analizi biriktir.'],
    [100, 'gold',    'Analiz Delisi',  '100 maç analizi biriktir.'],
    [500, 'diamond', 'Kütüphane',      '500 maç analizi biriktir.'],
]));
$list = array_merge($list, $fam('clean', 'analysis', 'check', 'clean_matches', [
    [1,   'bronze',  'Hatasız Gece', 'Bir maçı hiç blunder yapmadan bitir.'],
    [10,  'silver',  'İstikrar',     '10 hatasız (blunder’sız) maç oyna.'],
    [50,  'gold',    'Temiz Sicil',  '50 hatasız maç oyna.'],
    [100, 'diamond', 'Profesör',     '100 hatasız maç oyna.'],
]));
$list[] = $ev('skill_cerrah', 'analysis', 'Cerrah', 'Belirlenen çok düşük hata oranının altında bir maç tamamla.', 'target', 'flag_low_pr', 'epic', 750);
$list[] = $ev('skill_makine', 'analysis', 'Makine Gibi', 'Neredeyse kusursuz bir hata oranıyla maç tamamla.', 'star', 'flag_elite_pr', 'legendary', 1500);
$list[] = $ev('skill_kartal', 'analysis', 'Kartal Gözü', 'Bir maçta arka arkaya 20 en iyi hamleyi bul.', 'target', 'flag_bestmove20', 'epic', 750);

// ============ KÜP ============
$list[] = $ev('cube_first_double', 'cube', 'Cesur', 'İlk doğru Double (katlama) kararını ver.', 'target', 'flag_correct_double', 'uncommon', 250);
$list[] = $ev('cube_first_take', 'cube', 'Yemezler', 'İlk doğru Take (kabul) kararını ver.', 'target', 'flag_correct_take', 'uncommon', 250);
$list[] = $ev('cube_hard_take', 'cube', 'Soğukkanlı', 'Zor bir Take kararını doğru ver.', 'target', 'flag_hard_take', 'rare', 400);
$list[] = $ev('cube_take_win', 'cube', 'Küpü Ver!', 'Rakibin Double teklifini Take edip maçı kazan.', 'trophy', 'flag_take_and_win', 'rare', 400);
$list = array_merge($list, $fam('cubes', 'cube', 'target', 'correct_cube_decisions', [
    [10,   'bronze',  'Küp Acemisi',   '10 doğru küp kararı ver.'],
    [100,  'silver',  'Küp Ustası',    '100 doğru küp kararı ver.'],
    [500,  'gold',    'Küp Uzmanı',    '500 doğru küp kararı ver.'],
    [1000, 'diamond', 'Küp Profesörü', '1.000 doğru küp kararı ver.'],
]));

// ============ COIN / SERVET (anlık bakiye) ============
$list = array_merge($list, $fam('coin', 'coin', 'gift', 'coin_balance', [
    [1000,     'bronze',  'İlk Maaş',        '1.000 coin biriktir.'],
    [5000,     'bronze',  'Cebi Para Gördü', '5.000 coin biriktir.'],
    [10000,    'silver',  'Para Babası',     '10.000 coin biriktir.'],
    [50000,    'silver',  'Kasa Sağlam',     '50.000 coin biriktir.'],
    [100000,   'gold',    'Tavla Baronu',    '100.000 coin biriktir.'],
    [1000000,  'gold',    'Coin Milyoneri',  '1.000.000 coin biriktir.'],
    [5000000,  'diamond', 'Darphane',        '5.000.000 coin biriktir.'],
    [10000000, 'diamond', 'Merkez Bankası',  '10.000.000 coin biriktir.'],
]));
// LIFETIME kazanılan coin (ileri-dönük izlenir)
$list = array_merge($list, $fam('earned', 'coin', 'gift', 'lifetime_coin', [
    [10000,   'silver',  'Emekçi',      'Toplam 10.000 coin kazan.'],
    [100000,  'gold',    'Kazanç Makinesi', 'Toplam 100.000 coin kazan.'],
    [1000000, 'diamond', 'Servet Avcısı','Toplam 1.000.000 coin kazan.'],
]));

// ============ TURNUVA ============
$list = array_merge($list, $fam('tourney', 'tournament', 'trophy', 'tournaments_won', [
    [1,  'bronze',  'Şampiyon',            'Bir turnuva kazan.'],
    [5,  'silver',  'Kupa Avcısı',         '5 turnuva kazan.'],
    [10, 'gold',    'Kupa Koleksiyoncusu', '10 turnuva kazan.'],
    [50, 'diamond', 'Turnuva Efsanesi',    '50 turnuva kazan.'],
]));
$list = array_merge($list, $fam('tourneyplay', 'tournament', 'trophy', 'tournaments_played', [
    [1,  'bronze', 'Arenaya Adım',   'İlk turnuvana katıl.'],
    [10, 'silver', 'Turnuva Kurdu',  '10 turnuvaya katıl.'],
    [50, 'gold',   'Sürekli Rakip',  '50 turnuvaya katıl.'],
]));

// ============ RATING / LİDERLİK ============
$list[] = $ev('rating_firstup', 'rating', 'Yükselişte', 'İlk rütbe yükselişini yaşa.', 'crown', 'flag_rank_up', 'common', 150);
$list = array_merge($list, $fam('peak', 'rating', 'crown', 'best_rating', [
    [1600, 'silver',  'Usta',        '1600 rating’e ulaş.'],
    [1800, 'gold',    'Master',      '1800 rating’e ulaş.'],
    [2000, 'diamond', 'Grandmaster', '2000 rating’e ulaş.'],
    [2200, 'diamond', 'Efsane',      '2200 rating’e ulaş.'],
]));
$list[] = $ev('lb_top1000', 'rating', 'İlk 1000', 'Liderlik tablosunda ilk 1000’e gir.', 'crown', 'flag_top_1000', 'uncommon', 250);
$list[] = $ev('lb_top100', 'rating', 'İlk 100', 'Liderlik tablosunda ilk 100’e gir.', 'crown', 'flag_top_100', 'rare', 500);
$list[] = $ev('lb_top50', 'rating', 'İlk 50', 'Liderlik tablosunda ilk 50’ye gir.', 'crown', 'flag_top_50', 'rare', 750);
$list[] = $ev('lb_top10', 'rating', 'Elitler Kulübü', 'Liderlik tablosunda ilk 10’a gir.', 'crown', 'flag_top_10', 'epic', 1500);
$list[] = $ev('lb_top1', 'rating', 'Zirvede', 'Liderlik tablosunda 1. sıraya çık.', 'crown', 'flag_top_1', 'legendary', 3000);

// ============ SOSYAL ============
$list[] = $ev('social_nemesis', 'social', 'Nemesis', 'Aynı oyuncuyu 10 kez yen.', 'target', 'flag_nemesis', 'rare', 400);
$list[] = $ev('social_neighbor', 'social', 'Komşuda Pişer', 'Aynı oyuncuyla 20 maç oyna.', 'star', 'flag_neighbor', 'uncommon', 250);
$list[] = $ev('social_revenge', 'social', 'İntikam Soğuk Yenir', 'Aynı rakibe 3 kez yenildikten sonra onu yen.', 'flame', 'flag_revenge', 'rare', 400);

// ============ EĞLENCELİ ============
$list = array_merge($list, $fam('grind', 'fun', 'dice', 'matches_today', [
    [20, 'silver', 'Bir El Daha',   'Tek günde 20 maç oyna.'],
    [50, 'gold',   'Mesaiye Kaldık','Tek günde 50 maç oyna.'],
]));
$list[] = $ev('fun_nightowl', 'fun', 'Uyku Haram', '02:00–05:00 arasında 10 maç oyna.', 'dice', 'flag_night_owl', 'rare', 400);
$list[] = $ev('fun_morning', 'fun', 'Günaydın Tavla', '06:00–08:00 arasında bir maç kazan.', 'trophy', 'flag_morning_win', 'uncommon', 200);
$list[] = $ev('fun_stubborn', 'fun', 'İnatçı Keçi', '5 maçlık yenilgi serisinden sonra kazan.', 'flame', 'flag_stubborn', 'uncommon', 250);
$list[] = $ev('fun_improbable', 'fun', 'Fişi Çekmedi', '%5’in altındaki kazanma ihtimalinden maçı çevir.', 'flame', 'flag_improbable', 'epic', 750);
$list[] = $ev('fun_howcome', 'fun', 'Bu Nasıl Oldu?', 'Çok düşük kazanma ihtimalinden maçı çevir.', 'flame', 'flag_howcome', 'rare', 400);

// ============ GİZLİ ============
$list[] = $ev('hidden_anka', 'hidden', 'Anka Kuşu', '%2 veya daha düşük kazanma ihtimalinden maç kazan.', 'flame', 'flag_anka', 'legendary', 2000, true);
$list[] = $ev('hidden_david', 'hidden', 'David & Goliath', 'Kendinden çok daha yüksek ratingli rakibi yen.', 'crown', 'flag_david', 'epic', 1000, true);
$list[] = $ev('hidden_destiny', 'hidden', 'Kaderin Cilvesi', 'Berbat bir şans değerine rağmen kazan.', 'dice', 'flag_destiny', 'epic', 1000, true);
$list[] = $ev('hidden_perfect', 'hidden', 'Mükemmel Oyun', 'Uzun bir maçı kusursuza yakın hata oranıyla bitir.', 'star', 'flag_perfect_game', 'legendary', 2000, true);
$list[] = $ev('hidden_god', 'hidden', 'Tavla Tanrısı', 'Aynı maçta birkaç çok zor başarı şartını birden gerçekleştir.', 'crown', 'flag_tavla_god', 'mythic', 5000, true);
$list[] = $ev('hidden_42', 'hidden', '42', '???', 'star', 'flag_42', 'mythic', 4200, true);

return [
    // Rarity bantlari: bir rozeti kazanan oyuncu ORANI (kesir) >= esik ise o banda girer.
    // Yuksekten dusuge kontrol edilir. Config'den degistirilebilir (#11).
    'rarity_bands' => [
        'common'    => 0.40,   // > %40
        'uncommon'  => 0.20,   // %20–40
        'rare'      => 0.05,   // %5–20
        'epic'      => 0.01,   // %1–5
        'legendary' => 0.001,  // %0.1–1
        'mythic'    => 0.0,    // < %0.1
    ],

    // Event/gizli rozet esikleri — koda gomulu degil (#6, #19).
    'thresholds' => [
        'low_luck' => -6.0,        // flag_win_low_luck: luck <= bu
        'destiny_luck' => -14.0,   // flag_destiny (gizli, daha sert)
        'high_luck' => 8.0,        // flag_win_high_luck: luck >= bu
        'cerrah_pr' => 3.0,        // flag_low_pr: mac PR <= bu
        'elite_pr' => 1.5,         // flag_elite_pr (Makine Gibi)
        'perfect_pr' => 2.0,       // flag_perfect_game: PR <= bu VE match_length >= 5
        'perfect_min_length' => 5,
        'david_rating_gap' => 300, // flag_david: opponent_rating - rating_before >= bu
        'stubborn_losses' => 5,    // flag_stubborn: bu win oncesi loss serisi >= bu
        'bestmove_streak' => 20,   // flag_bestmove20
        'five_doubles' => 5,       // flag_five_doubles
        'cube_correct_eqloss' => 0.02, // <= bu ise dogru kup karari
        'hard_take_wp' => 30.0,    // flag_hard_take: kazanma ihtimali <= bu iken dogru take
        'anka_wp' => 2.0,          // flag_anka
        'improbable_wp' => 5.0,    // flag_improbable
        'howcome_wp' => 15.0,      // flag_howcome
        'comeback_wp' => 20.0,     // flag_comeback (Eve Donus)
        'night_start' => 2, 'night_end' => 5,     // gece baykusu saat araligi [start,end)
        'morning_start' => 6, 'morning_end' => 8,  // gunaydin araligi
        'nemesis_beats' => 10,     // ayni rakibi bu kadar yen
        'neighbor_meets' => 20,    // ayni rakiple bu kadar mac
        'revenge_losses' => 3,     // once bu kadar yenil, sonra yen
        'clean_min_decisions' => 12, // "hatasiz" sayilmak icin macta en az bu kadar oyuncu karari
        'god_conditions' => 3,     // flag_tavla_god: ayni macta en az bu kadar zor sart
    ],

    'list' => $list,
];
