<?php

namespace App\Analysis;

/**
 * Pozisyon Ozellik Cikarici (tek katman — brief §4).
 *
 * Board konvansiyonu src/engine/types.ts ile BIREBIR:
 *   points: 24 int. index 0 = 1. ucgen ... index 23 = 24. ucgen.
 *   pozitif = beyaz (white), negatif = siyah (black), mutlak = tas sayisi.
 *   WHITE: home = index 0..5, index 0 altina toplar, yon yuksek->dusuk. Bar giris 24-zar.
 *   BLACK: home = index 18..23, index 23 ustune toplar, yon dusuk->yuksek. Bar giris zar-1.
 *
 * Kategori fonksiyonlari board'u tekrar tekrar hesaplamasin diye TUM ozellikler
 * burada bir kez cikarilir (PositionClassifier bunu tuketir).
 *
 * "my"/"opponent": karari VEREN oyuncuya (player) gore.
 */
final class PositionFeatureExtractor
{
    /**
     * @param  array  $pos  Decode edilmis GameState: points[], bar{white,black}, off{white,black}
     * @param  string  $player  'white' | 'black' — karari veren
     * @param  int  $plyNumber  mac icindeki karar sirasi (0-tabanli)
     * @return array PositionFeatures (brief §4)
     */
    public static function extract(array $pos, string $player, int $plyNumber = 0): array
    {
        $points = self::normalizePoints($pos['points'] ?? []);
        $bar = $pos['bar'] ?? [];
        $off = $pos['off'] ?? [];

        $white = $player === 'white';
        // mine(i) / opp(i): karari veren oyuncunun / rakibin i indexindeki tas sayisi (>=0)
        $mineAt = fn (int $i): int => $white ? max($points[$i], 0) : max(-$points[$i], 0);
        $oppAt = fn (int $i): int => $white ? max(-$points[$i], 0) : max($points[$i], 0);

        $myBar = (int) ($white ? ($bar['white'] ?? 0) : ($bar['black'] ?? 0));
        $oppBar = (int) ($white ? ($bar['black'] ?? 0) : ($bar['white'] ?? 0));

        // Bolgeler (karari verene gore):
        //   myHome  = kendi ic sahasi (toplama bolgesi)
        //   oppHome = rakip ic sahasi (benim arka anchor'larim burada durur)
        $myHome = $white ? range(0, 5) : range(18, 23);
        $oppHome = $white ? range(18, 23) : range(0, 5);
        // Dis sahalar (iki orta ceyrek) — spare/timing icin
        $outer = range(6, 17);

        // Rakip ic sahasindaki bir index'in "rakip point numarasi" (1=rakip as/en derin).
        $oppPointNo = fn (int $i): int => $white ? (24 - $i) : ($i + 1);
        // Kendi ic sahasindaki index'in "kendi point numarasi" (1=kendi as).
        $myPointNo = fn (int $i): int => $white ? ($i + 1) : (24 - $i);

        // --- Pip sayimi ---
        $myPip = $myBar * 25;
        $oppPip = $oppBar * 25;
        for ($i = 0; $i < 24; $i++) {
            $w = max($points[$i], 0);
            $b = max(-$points[$i], 0);
            // beyaz i'de -> i+1 pip; siyah i'de -> 24-i pip
            if ($white) {
                $myPip += $w * ($i + 1);
                $oppPip += $b * (24 - $i);
            } else {
                $myPip += $b * (24 - $i);
                $oppPip += $w * ($i + 1);
            }
        }

        // --- Bear-off (off yoksa 15'ten turet) ---
        $myOnBoard = $myBar;
        $oppOnBoard = $oppBar;
        for ($i = 0; $i < 24; $i++) {
            $myOnBoard += $mineAt($i);
            $oppOnBoard += $oppAt($i);
        }
        $myBorneOff = isset($off[$white ? 'white' : 'black'])
            ? (int) $off[$white ? 'white' : 'black']
            : max(0, 15 - $myOnBoard);
        $oppBorneOff = isset($off[$white ? 'black' : 'white'])
            ? (int) $off[$white ? 'black' : 'white']
            : max(0, 15 - $oppOnBoard);

        // --- Temas / yaris ---
        // whiteMaxIdx = en yuksek index'te beyaz; blackMinIdx = en dusuk index'te siyah.
        $whiteMaxIdx = null;
        $blackMinIdx = null;
        for ($i = 23; $i >= 0; $i--) {
            if ($points[$i] > 0) { $whiteMaxIdx = $i; break; }
        }
        for ($i = 0; $i < 24; $i++) {
            if ($points[$i] < 0) { $blackMinIdx = $i; break; }
        }
        $barContact = $myBar > 0 || $oppBar > 0;
        $contactExists = $barContact
            || ($whiteMaxIdx !== null && $blackMinIdx !== null && $whiteMaxIdx >= $blackMinIdx);
        $pureRace = ! $contactExists;

        // --- Home board made points ---
        $myHomePointsMade = 0;
        foreach ($myHome as $i) {
            if ($mineAt($i) >= 2) { $myHomePointsMade++; }
        }
        $oppHomePointsMade = 0;
        foreach ($oppHome as $i) {
            if ($oppAt($i) >= 2) { $oppHomePointsMade++; }
        }

        // --- Anchorlar ---
        // myAnchors: rakip ic sahasinda tuttugum made point'ler (rakip point no listesi)
        $myAnchors = [];
        foreach ($oppHome as $i) {
            if ($mineAt($i) >= 2) { $myAnchors[] = $oppPointNo($i); }
        }
        sort($myAnchors);
        // opponentAnchors: rakibin BENIM ic sahamda tuttugu made point'ler (benim point no)
        $opponentAnchors = [];
        foreach ($myHome as $i) {
            if ($oppAt($i) >= 2) { $opponentAnchors[] = $myPointNo($i); }
        }
        sort($opponentAnchors);

        $myDeepAnchors = array_values(array_filter($myAnchors, fn ($p) => $p <= 3));
        $myAdvancedAnchors = array_values(array_filter($myAnchors, fn ($p) => $p >= 4 && $p <= 6));

        // --- Blotlar (tek tas) ---
        $myBlots = [];
        $oppBlots = [];
        for ($i = 0; $i < 24; $i++) {
            if ($mineAt($i) === 1) { $myBlots[] = $i; }
            if ($oppAt($i) === 1) { $oppBlots[] = $i; }
        }

        // --- Primeler (ardisik made point'ler) ---
        [$myLongestPrime, $myPrimeRuns] = self::longestPrime($mineAt);
        [$oppLongestPrime, $oppPrimeRuns] = self::longestPrime($oppAt);
        $mySixPrime = self::hasTrappingSixPrime($myPrimeRuns, $white, $oppAt, $oppBar, true);
        $oppSixPrime = self::hasTrappingSixPrime($oppPrimeRuns, ! $white, $mineAt, $myBar, false);

        // --- Geri tas sayisi (rakip ic sahasi + bar) ---
        $myCheckersBack = $myBar;
        foreach ($oppHome as $i) { $myCheckersBack += $mineAt($i); }
        $oppCheckersBack = $oppBar;
        foreach ($myHome as $i) { $oppCheckersBack += $oppAt($i); }

        // --- Dis saha spare'lari (timing proxy) ---
        $myOuterSpares = 0;
        $oppOuterSpares = 0;
        foreach ($outer as $i) {
            $myOuterSpares += max($mineAt($i) - 2, 0);
            $oppOuterSpares += max($oppAt($i) - 2, 0);
        }

        // --- Vurus imkani (direkt 1..6 shot; dolayli v1'de yok — heuristic) ---
        $hitPossible = $contactExists && self::directShotExists($white, $points, $oppBlots, $myBar);

        $bearingOffStarted = $myBorneOff > 0;

        return [
            'plyNumber' => $plyNumber,

            'myPipCount' => $myPip,
            'opponentPipCount' => $oppPip,
            'combinedPipCount' => $myPip + $oppPip,

            'myBarCheckers' => $myBar,
            'opponentBarCheckers' => $oppBar,

            'myBorneOff' => $myBorneOff,
            'opponentBorneOff' => $oppBorneOff,

            'contactExists' => $contactExists,
            'pureRace' => $pureRace,

            'myHomeBoardPointsMade' => $myHomePointsMade,
            'opponentHomeBoardPointsMade' => $oppHomePointsMade,

            'myAnchors' => $myAnchors,
            'opponentAnchors' => $opponentAnchors,
            'myDeepAnchors' => $myDeepAnchors,
            'myAdvancedAnchors' => $myAdvancedAnchors,

            'myBlots' => $myBlots,
            'opponentBlots' => $oppBlots,

            'myLongestPrime' => $myLongestPrime,
            'opponentLongestPrime' => $oppLongestPrime,
            'mySixPrime' => $mySixPrime,
            'opponentSixPrime' => $oppSixPrime,

            'myCheckersBack' => $myCheckersBack,
            'opponentCheckersBack' => $oppCheckersBack,

            'myOuterBoardSpares' => $myOuterSpares,
            'opponentOuterBoardSpares' => $oppOuterSpares,

            'hitPossible' => $hitPossible,
            'bearingOffStarted' => $bearingOffStarted,
        ];
    }

    /** points'i 24-uzunluk int dizisine normalize et (eksikse 0). */
    private static function normalizePoints(array $raw): array
    {
        $p = [];
        for ($i = 0; $i < 24; $i++) {
            $p[$i] = (int) ($raw[$i] ?? 0);
        }

        return $p;
    }

    /**
     * En uzun ardisik made-point (>=2) serisi + tum seri araliklarini dondur.
     * @param  callable  $at  fn(int $index): int
     * @return array{0:int,1:array<array{0:int,1:int}>}  [enUzun, [[start,end], ...]]
     */
    private static function longestPrime(callable $at): array
    {
        $longest = 0;
        $runs = [];
        $start = null;
        for ($i = 0; $i < 24; $i++) {
            if ($at($i) >= 2) {
                if ($start === null) { $start = $i; }
            } elseif ($start !== null) {
                $runs[] = [$start, $i - 1];
                $longest = max($longest, $i - $start);
                $start = null;
            }
        }
        if ($start !== null) {
            $runs[] = [$start, 23];
            $longest = max($longest, 24 - $start);
        }

        return [$longest, $runs];
    }

    /**
     * 6+ ardisik made point VAR ve rakibin en az bir tasini gercekten arkasinda tuzakliyorsa true.
     * @param  array<array{0:int,1:int}>  $runs  prime sahibinin seri araliklari
     * @param  bool  $ownerIsWhite  prime sahibi beyaz mi
     * @param  callable  $oppAt  fn(int): int — rakip tas sayisi
     * @param  int  $oppBar  rakip bar tasi
     */
    private static function hasTrappingSixPrime(array $runs, bool $ownerIsWhite, callable $oppAt, int $oppBar, bool $unused = false): bool
    {
        foreach ($runs as [$s, $e]) {
            if ($e - $s + 1 < 6) {
                continue;
            }
            // Bar'daki rakip her zaman tuzakli sayilir.
            if ($oppBar > 0) {
                return true;
            }
            // Rakip yonune gore prime'in "gerisinde" tas var mi?
            // Beyaz prime (rakip=siyah, yukari gider): siyah tas index < s ise tuzakli.
            // Siyah prime (rakip=beyaz, asagi gider): beyaz tas index > e ise tuzakli.
            if ($ownerIsWhite) {
                for ($i = 0; $i < $s; $i++) {
                    if ($oppAt($i) > 0) { return true; }
                }
            } else {
                for ($i = $e + 1; $i < 24; $i++) {
                    if ($oppAt($i) > 0) { return true; }
                }
            }
        }

        return false;
    }

    /**
     * Direkt (1..6) vurus imkani var mi? Ara point'lerin bloklu olup olmadigina bakmadan,
     * yalniz mesafe 1..6 icinde hareket yonunde rakip blot'a ulasan tasim var mi (v1 yaklasik).
     * @param  array  $oppBlots  rakip blot index'leri
     */
    private static function directShotExists(bool $white, array $points, array $oppBlots, int $myBar): bool
    {
        if (empty($oppBlots)) {
            return false;
        }
        foreach ($oppBlots as $b) {
            // Bar'dan giris de vurus olabilir
            if ($myBar > 0) {
                $entry = $white ? (24 - $b) : ($b + 1); // gereken zar
                if ($entry >= 1 && $entry <= 6) {
                    return true;
                }
            }
            for ($m = 0; $m < 24; $m++) {
                $mine = $white ? max($points[$m], 0) : max(-$points[$m], 0);
                if ($mine < 1) {
                    continue;
                }
                // beyaz asagi (m>b), siyah yukari (m<b)
                $dist = $white ? ($m - $b) : ($b - $m);
                if ($dist >= 1 && $dist <= 6) {
                    return true;
                }
            }
        }

        return false;
    }
}
