<?php

namespace App\Support;

/**
 * ADIM -> BACKGAMMON NOTASYONU (sunucu-otoriter). Node validator'ın kabul ettiği adımlar
 * ({from,to,die}, iç indeks 0-23 / 'bar' / 'off') oyuncu perspektifli .mat notasyonuna çevrilir:
 *   "24/18 13/11", "bar/23", "6/off", tekrar "8/3(2)".
 *
 * Perspektif (Backgammon.php + src/engine ile AYNI, MatReplayLegalityTest ile birebir):
 *   beyaz nokta = iç_indeks + 1 ; siyah nokta = 24 - iç_indeks.
 * Her die AYRI token yazılır ("24/18 18/16" — zincir sıkıştırma YOK): kesin + baştan-sona
 * oynatılabilir; gnubg parse eder. Ardışık AYNI token "(n)" ile sıkışır (gnubg-native).
 */
class MoveNotation
{
    /**
     * @param  list<array{from:mixed,to:mixed,die?:int}>  $steps  oynanan adımlar (sıra korunur)
     */
    public static function render(array $steps, string $player): string
    {
        $tokens = [];
        foreach ($steps as $s) {
            $from = $s['from'] ?? null;
            $to = $s['to'] ?? null;
            if ($from === null || $to === null) {
                continue;
            }
            $tokens[] = self::point($from, $player).'/'.self::point($to, $player);
        }
        if (! $tokens) {
            return '';
        }

        // Ardışık aynı token -> "(n)" (gnubg-native tekrar biçimi).
        $out = [];
        $i = 0;
        $n = count($tokens);
        while ($i < $n) {
            $tok = $tokens[$i];
            $count = 1;
            while ($i + $count < $n && $tokens[$i + $count] === $tok) {
                $count++;
            }
            $out[] = $count > 1 ? "$tok($count)" : $tok;
            $i += $count;
        }

        return implode(' ', $out);
    }

    /** İç indeks (0-23) / 'bar' / 'off' -> oyuncu perspektifli nokta metni. */
    private static function point(mixed $x, string $player): string
    {
        if ($x === 'bar' || $x === 'off') {
            return (string) $x;
        }
        $i = (int) $x;

        return (string) ($player === 'white' ? $i + 1 : 24 - $i);
    }
}
