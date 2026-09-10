<?php

namespace App\Support;

/**
 * .mat SERİLEŞTİRİCİ — TEK KAYNAK (single source of truth).
 *
 * Eskiden .mat üretimi ÜÇ yerde tekrarlanıyordu: src/matExport.ts (buildMat + buildMatXg),
 * MatBuilder.php (gnubg native), MatFromLog.php (XG). Küp-çiftleme, zar/hamle dönüşümü ve satır
 * kurma mantığı kopyalanmıştı -> biri düzeltilip diğeri unutulunca sapma (bug) oluşuyordu.
 *
 * Artık HER backend .mat çıktısı BURADAN geçer. İki GİRDİ ŞEMASI (zengin MoveLogEntry[] ve kompakt
 * game_logs turları) kendi ADAPTÖRÜNDE (MatBuilder / MatFromLog) NORMALLEŞTİRİLİP ortak "oyun
 * modeli"ne çevrilir; segmentasyon + sonuç türetme adaptörde kalır (kaynağa özgü: tahta-reset vs
 * s-reset). Bu sınıf yalnız MODELİ metne döker. İki LEHÇE vardır:
 *
 *  - 'gnubg' : GNU Backgammon NATIVE .mat (Tavlai Luck V1 kaynağı). `bar/20`, `6/off`, `8/3(2)`
 *              (tekrar parantezli), ham zar sırası, başlıksız, "Wins N point(s)" (çoğul), puan
 *              maç uzunluğuna KIRPILIR. BU ÇIKTI DEĞİŞMEMELİ — MatBuilderTest onu commit'li
 *              fixture (bot-match.mat) ile BYTE-BYTE karşılaştırır (luck regresyon kalkanı).
 *  - 'xg'    : Extreme Gammon uyumlu .mat (kullanıcı indirmesi). `; [Site ...]` başlığı, `bar->25`,
 *              `off->0`, tekrarlar açık (parantez yok), KANONİK zar (yüksek önce), oyun sonu
 *              numaralı iki-sütun "Losses/Wins X point", maç bitince "and the match".
 *
 * OYUN MODELİ: her oyun ['acts' => Act[], 'outcome' => {winner,points}|null].
 *   Act = ['kind'=>'move'|'double'|'take'|'drop', 'player'=>'white'|'black', 'dice'=>int[]?, 'notation'=>string?]
 *   acts ÇİFTLENMİŞ olmalı (bkz. pairCube) -> her "double"ın ardından "take"/"drop".
 */
class MatSerializer
{
    /**
     * Oyun modelini .mat metnine dönüştür.
     *
     * @param  list<array{acts: list<array>, outcome: ?array{winner:string,points:int}}>  $games
     * @param  array{dialect?:string,matchLength?:int,whiteName?:string,blackName?:string,site?:string,matchId?:string,eventDate?:string,eventTime?:string,crawford?:bool}  $opts
     */
    public static function render(array $games, array $opts = []): string
    {
        $dialect = ($opts['dialect'] ?? 'xg') === 'gnubg' ? 'gnubg' : 'xg';
        $matchLength = max(1, (int) ($opts['matchLength'] ?? 1));
        $whiteName = $opts['whiteName'] ?? ($dialect === 'gnubg' ? 'White' : 'Player1');
        $blackName = $opts['blackName'] ?? ($dialect === 'gnubg' ? 'Black' : 'Player2');
        $COLW = $dialect === 'gnubg' ? 34 : 28;

        $out = [];
        if ($dialect === 'xg') {
            $site = $opts['site'] ?? 'TavlaTV';
            $matchId = $opts['matchId'] ?? '0';
            $eventDate = $opts['eventDate'] ?? '';
            $eventTime = $opts['eventTime'] ?? '';
            $crawford = ($opts['crawford'] ?? true) ? 'On' : 'Off';
            $out = [
                "; [Site \"$site\"]",
                "; [Match ID \"$matchId\"]",
                "; [Player 1 \"$whiteName\"]",
                "; [Player 2 \"$blackName\"]",
                '; [Player 1 Elo "0"]',
                '; [Player 2 Elo "0"]',
                "; [EventDate \"$eventDate\"]",
                "; [EventTime \"$eventTime\"]",
                '; [Variation "Backgammon"]',
                '; [Unrated "Off"]',
                "; [Crawford \"$crawford\"]",
                '; [CubeLimit "1024"]',
                '',
            ];
        }
        $out[] = "$matchLength point match";

        $sw = 0;
        $sb = 0;
        $gi = 0;
        foreach ($games as $game) {
            $gi++;
            $out[] = '';
            $out[] = " Game $gi";
            $out[] = ' '.str_pad("$whiteName : $sw", $COLW + 4)."$blackName : $sb";

            // Satırları kur (küp değeri render sırasında yürür; iki lehçede de aynı).
            $lines = [];
            $cube = 1;
            foreach ($game['acts'] as $a) {
                $text = self::actText($a, $dialect, $cube);
                if (($a['kind'] ?? '') === 'take') {
                    $cube *= 2;
                }
                $special = ($a['kind'] ?? 'move') !== 'move';
                if ($a['player'] === 'white') {
                    // XG: sol sütun hamle-DIŞI girdi bir boşluk girintili. gnubg: girintisiz.
                    $lines[] = ['w' => ($dialect === 'xg' && $special) ? " $text" : $text];
                } else {
                    $li = count($lines) - 1;
                    if ($li >= 0 && array_key_exists('w', $lines[$li]) && ! array_key_exists('b', $lines[$li])) {
                        $lines[$li]['b'] = $text;
                    } else {
                        $lines[] = ['b' => $text];
                    }
                }
            }
            foreach ($lines as $idx => $r) {
                $out[] = rtrim(sprintf('%3d) %s%s', $idx + 1, str_pad($r['w'] ?? '', $COLW), $r['b'] ?? ''));
            }

            $oc = $game['outcome'] ?? null;
            if ($oc) {
                if ($dialect === 'gnubg') {
                    // Puan maç uzunluğuna KIRP (kalan puana); "Wins N point(s)" çoğul; numaralı satır YOK.
                    $pts = $oc['points'];
                    $need = $matchLength - ($oc['winner'] === 'white' ? $sw : $sb);
                    if ($need > 0) {
                        $pts = min($pts, $need);
                    }
                    $winTxt = "Wins $pts point".($pts === 1 ? '' : 's');
                    $out[] = $oc['winner'] === 'white' ? "      $winTxt" : '      '.str_pad('', $COLW).$winTxt;
                    if ($oc['winner'] === 'white') {
                        $sw += $pts;
                    } else {
                        $sb += $pts;
                    }
                } else {
                    // XG: puan KIRPILMAZ; "and the match" hedefe ulaşınca; siyah kazanınca numaralı iki-sütun.
                    $pts = $oc['points'];
                    if ($oc['winner'] === 'white') {
                        $sw += $pts;
                    } else {
                        $sb += $pts;
                    }
                    $matchOver = ($oc['winner'] === 'white' ? $sw : $sb) >= $matchLength;
                    $winTxt = "Wins $pts point".($matchOver ? ' and the match' : '');
                    if ($oc['winner'] === 'black') {
                        $num = count($lines) + 1;
                        $out[] = rtrim(sprintf('%3d) %s%s', $num, str_pad(' Losses '.$pts.' point', $COLW), $winTxt));
                    } else {
                        $out[] = "      $winTxt";
                    }
                }
            }
        }

        return implode("\n", $out)."\n";
    }

    /** Tek eylemin metni (lehçeye göre zar/hamle biçimi). */
    private static function actText(array $a, string $dialect, int $cube): string
    {
        $kind = $a['kind'] ?? 'move';
        if ($kind === 'double') {
            return 'Doubles => '.($cube * 2);
        }
        if ($kind === 'take') {
            return 'Takes';
        }
        if ($kind === 'drop') {
            return 'Drops';
        }
        // move
        $dice = $a['dice'] ?? [];
        $notation = (string) ($a['notation'] ?? '');
        if ($dialect === 'gnubg') {
            $d = count($dice) >= 2 ? "{$dice[0]}{$dice[1]}" : '  ';
            $mv = ($notation !== '' && $notation !== 'pas' && $notation !== 'pass') ? $notation : '';
        } else {
            $d = self::xgDiceInts($dice);
            $mv = ($notation !== '' && $notation !== 'pas' && $notation !== 'pass') ? self::xgMoves($notation) : '';
        }

        return $mv !== '' ? "$d: $mv" : "$d:";
    }

    /**
     * Küp teklif/yanıt ÇİFTLEME (buildMat.actsOf / buildMatXg.actsOf ORTAK portu). Ham eylem
     * dizisinde her "double"ın hemen ardından rakibin "take"/"drop" yanıtı gelir; eksik kayıt
     * (senkron gönderilememiş) oyunun akışından ÜRETİLİR -> askıda küp satırı .mat'i bozmaz.
     *
     * @param  list<array>  $raw  ham eylemler [{kind,player,dice?,notation?}]
     * @return list<array>
     */
    public static function pairCube(array $raw): array
    {
        $out = [];
        $pending = null;
        $opp = fn (string $p) => $p === 'white' ? 'black' : 'white';
        $answer = function (string $kind) use (&$out, &$pending, $opp) {
            if (! $pending) {
                return;
            }
            $out[] = ['kind' => $kind, 'player' => $opp($pending['player'])];
            $pending = null;
        };
        foreach ($raw as $a) {
            if ($a['kind'] === 'double') {
                $answer('take');
                $out[] = $a;
                $pending = $a;

                continue;
            }
            if ($a['kind'] === 'take' || $a['kind'] === 'drop') {
                if (! $pending || $pending['player'] !== $opp($a['player'])) {
                    $out[] = ['kind' => 'double', 'player' => $opp($a['player'])];
                }
                $pending = null;
                $out[] = $a;

                continue;
            }
            $answer('take');
            $out[] = $a;
        }
        $answer('drop');

        return $out;
    }

    /**
     * KANONİK ZAR (XG): DAİMA yüksek zar önce ("6-5"/"5-6" -> "65"). Aynı atış her zaman aynı
     * yazılır -> kaynaktan bağımsız deterministik. SADECE görüntü sırası; hamle token'ları değişmez.
     */
    public static function xgDiceInts(array $dice): string
    {
        if (count($dice) < 2) {
            return '';
        }
        $a = (int) $dice[0];
        $b = (int) $dice[1];

        return $a >= $b ? "$a$b" : "$b$a";
    }

    /** Ham zar metni ("6-5" / "6-6-6-6") -> KANONİK "65". 3+ haneli (dance) girdide ilk iki zar. */
    public static function xgDice(string $raw): string
    {
        $digits = preg_replace('/[^1-6]/', '', $raw) ?? '';
        if (strlen($digits) < 2) {
            return $digits;
        }

        return self::xgDiceInts([(int) $digits[0], (int) $digits[1]]);
    }

    /** Notasyonu XG lehçesine çevir + tekrarları aç ("8/3(2)" -> "8/3 8/3"). */
    public static function xgMoves(string $notation): string
    {
        $tokens = preg_split('/\s+/', trim($notation), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $out = [];
        foreach ($tokens as $tok) {
            foreach (self::xgToken($tok) as $t) {
                $out[] = $t;
            }
        }

        return implode(' ', $out);
    }

    /** Tek token: "bar/20"->["25/20"], "8/3(2)"->["8/3","8/3"], "6/off"->["6/0"]; vuruş (*) korunur. */
    private static function xgToken(string $tok): array
    {
        if (! preg_match('/^(.+?)(?:\((\d+)\))?$/', $tok, $m)) {
            return [$tok];
        }
        $path = $m[1];
        $n = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : 1;
        $conv = implode('/', array_map(function ($seg) {
            $star = str_ends_with($seg, '*') ? '*' : '';
            $core = $star ? substr($seg, 0, -1) : $seg;
            $mapped = $core === 'bar' ? '25' : ($core === 'off' ? '0' : $core);

            return $mapped.$star;
        }, explode('/', $path)));

        return array_fill(0, max(1, $n), $conv);
    }
}
