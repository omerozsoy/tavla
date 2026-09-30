<?php

// Turnuva ayarları. Eleme ağacı (bracket) 3.'lük takılma çözümü + 3 Haklı Swiss varsayılanları.
return [
    // 3.'lük maçına kimse gelmezse (oda açılmadı) bu kadar dk sonra rating ile çözülür (final açılsın).
    'third_place_stall_minutes' => (int) env('TOURNAMENT_STALL_MINUTES', 3),

    // 3 Haklı Swiss (Swiss Triple Elimination) — feature flag + varsayılan zaman ayarları.
    'swiss' => [
        'enabled' => (bool) env('FEATURE_SWISS_TRIPLE', true), // kapatılırsa yeni Swiss turnuvası kurulamaz
        'arrive_minutes' => (int) env('SWISS_ARRIVE_MINUTES', 5),      // maça gelme süresi (contract §4)
        'round_gap_seconds' => (int) env('SWISS_ROUND_GAP_SECONDS', 30), // turlar arası bekleme
    ],
];
