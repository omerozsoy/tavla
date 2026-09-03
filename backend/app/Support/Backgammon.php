<?php

namespace App\Support;

/**
 * Sunucu-otoriter oyun durumu yardımcıları (para maçı güvenliği Faz 2b).
 * Motor DEĞİL — yalnız başlangıç kurulumu + oyun-sonu tespiti. Hamle yasallığı Node validator'da.
 *
 * Tahta konvansiyonu (src/engine/types.ts ile AYNI): points[24], pozitif=beyaz, negatif=siyah.
 */
class Backgammon
{
    /** Standart açılış tahtası (src/engine board.ts initialState ile birebir). */
    public static function initialState(): array
    {
        return [
            'points' => [2, 0, 0, 0, 0, -5, 0, -3, 0, 0, 0, 5, -5, 0, 0, 0, 3, 0, 5, 0, 0, 0, 0, -2],
            'bar' => ['white' => 0, 'black' => 0],
            'off' => ['white' => 0, 'black' => 0],
            'turn' => 'white',
            'dice' => [],
            'diceUsed' => [],
        ];
    }

    /** Oyun bitti mi? Biten tarafın rengi ('white'/'black'), yoksa null (15 taş toplandı). */
    public static function winner(array $state): ?string
    {
        $off = $state['off'] ?? [];
        if ((int) ($off['white'] ?? 0) >= 15) {
            return 'white';
        }
        if ((int) ($off['black'] ?? 0) >= 15) {
            return 'black';
        }

        return null;
    }

    /**
     * Oyun puanı (küp ÇARPANI HARİÇ): 1 normal, 2 gammon, 3 backgammon.
     * $winner 15 taşı topladı. Kaybeden:
     *  - en az 1 taş topladıysa -> 1 (normal)
     *  - hiç toplamadı + (bar'da taşı VAR ya da kazananın ev bölgesinde taşı VAR) -> 3 (backgammon)
     *  - hiç toplamadı ama yukarıdakiler yok -> 2 (gammon)
     * Konvansiyon: points[0..5]=beyazın evi, points[18..23]=siyahın evi. (src/engine/cube ile aynı.)
     */
    public static function gamePoints(array $state, string $winner): int
    {
        $loser = $winner === 'white' ? 'black' : 'white';
        $off = $state['off'] ?? [];
        if ((int) ($off[$loser] ?? 0) > 0) {
            return 1; // kaybeden bir şey topladı -> normal
        }
        // Gammon mu backgammon mu? Kaybedenin bar'da ya da KAZANANIN ev bölgesinde taşı var mı?
        $bar = $state['bar'] ?? [];
        if ((int) ($bar[$loser] ?? 0) > 0) {
            return 3; // bar'da taş -> backgammon
        }
        $points = $state['points'] ?? [];
        // Kazananın ev bölgesi indeksleri + kaybedenin taşının işareti.
        $range = $winner === 'white' ? range(0, 5) : range(18, 23);
        foreach ($range as $i) {
            $v = (int) ($points[$i] ?? 0);
            $loserHere = $loser === 'white' ? $v > 0 : $v < 0;
            if ($loserHere) {
                return 3; // kazananın evinde kaybeden taşı -> backgammon
            }
        }

        return 2; // hiç toplamadı, bar/ev yok -> gammon
    }
}
