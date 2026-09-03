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
}
