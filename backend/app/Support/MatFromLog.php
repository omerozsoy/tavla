<?php

namespace App\Support;

/**
 * game_logs KOMPAKT tur kaydından ( {g,s,p,d,m,o,k} ) XG-uyumlu .mat metni üretir.
 *
 * Neden bu, MatBuilder değil: MatBuilder ZENGİN MoveLogEntry[] (pos/dice/notation/cube) ister ve
 * yalnız match_results.log'da bulunur; oraya erişim online'da room_code ile mümkündür, pvb/local'de
 * game_logs ile HİÇBİR ortak anahtar yoktur. game_logs kompakt turları ise HER maçta vardır ve
 * TAMDIR (online: p1_events[beyaz]+p2_events[siyah] birleşir; pvb/local: tek istemci ikisini de
 * yazar). Böylece yönetim panelinde HER maç için (eski kayıtlar dahil) .mat üretilebilir.
 *
 * Çıktı src/matExport.ts buildMatXg ile aynı XG lehçesini kullanır: `; [Site ...]` başlığı,
 * `bar->25`, `off->0`, tekrarlar açık (parantez yok), oyun sonu numaralı iki-sütun
 * "Losses/Wins X point" satırı, maç bitince "and the match". gnubg NATIVE .mat DEĞİLDİR
 * (gnubg'ye verme); bu XG (Extreme Gammon) içindir.
 */
class MatFromLog
{
    /**
     * @param  array  $turns  GameLog::mergedTurns() çıktısı (g,s ye göre sıralı kompakt turlar)
     * @param  array{whiteName?:string,blackName?:string,matchLength?:int,site?:string,matchId?:string,eventDate?:string,eventTime?:string,crawford?:bool}  $opts
     */
    public static function build(array $turns, array $opts = []): string
    {
        $whiteName = $opts['whiteName'] ?? 'Player1';
        $blackName = $opts['blackName'] ?? 'Player2';
        $matchLength = max(1, (int) ($opts['matchLength'] ?? 1));
        $site = $opts['site'] ?? 'TavlaTV';
        $matchId = $opts['matchId'] ?? '0';
        $eventDate = $opts['eventDate'] ?? '';
        $eventTime = $opts['eventTime'] ?? '';
        $crawford = ($opts['crawford'] ?? true) ? 'On' : 'Off';
        $COLW = 28; // buildMatXg ile birebir (sol aksiyon 28'e padlenir -> sağ sütun col 33)

        // Oyunlara böl (kompakt log otoriter oyun numarası g taşır -> seq tahminine gerek yok).
        $games = [];
        foreach ($turns as $t) {
            $g = (int) ($t['g'] ?? 1);
            $games[$g][] = $t;
        }
        ksort($games);

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
            "$matchLength point match",
        ];

        $sw = 0;
        $sb = 0;
        $gi = 0;
        foreach ($games as $rows) {
            $gi++;
            $out[] = '';
            $out[] = " Game $gi";
            $out[] = ' '.str_pad("$whiteName : $sw", $COLW + 4)."$blackName : $sb";

            [$acts, $outcome] = self::actsAndOutcome($rows);

            $lines = [];
            $cube = 1;
            foreach ($acts as $a) {
                if ($a['kind'] === 'move') {
                    $d = $a['dice'];
                    $mv = $a['moves'];
                    $text = $mv !== '' ? "$d: $mv" : "$d:";
                } elseif ($a['kind'] === 'double') {
                    $text = 'Doubles => '.($cube * 2);
                } elseif ($a['kind'] === 'take') {
                    $cube *= 2;
                    $text = 'Takes';
                } else {
                    $text = 'Drops';
                }
                $special = $a['kind'] !== 'move';
                if ($a['player'] === 'white') {
                    // Referans XG: sol sütun hamle-dışı girdi bir boşluk girintili.
                    $lines[] = ['w' => $special ? " $text" : $text];
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
                $left = str_pad($r['w'] ?? '', $COLW);
                $out[] = rtrim(sprintf('%3d) %s%s', $idx + 1, $left, $r['b'] ?? ''));
            }

            if ($outcome) {
                $pts = $outcome['points'];
                if ($outcome['winner'] === 'white') {
                    $sw += $pts;
                } else {
                    $sb += $pts;
                }
                $matchOver = ($outcome['winner'] === 'white' ? $sw : $sb) >= $matchLength;
                $winTxt = "Wins $pts point".($matchOver ? ' and the match' : '');
                if ($outcome['winner'] === 'black') {
                    $loseTxt = "Losses $pts point";
                    $num = count($lines) + 1;
                    $out[] = rtrim(sprintf('%3d) %s%s', $num, str_pad(" $loseTxt", $COLW), $winTxt));
                } else {
                    $out[] = "      $winTxt";
                }
            }
        }

        return implode("\n", $out)."\n";
    }

    /**
     * Kompakt turları normalleştirilmiş eylem dizisine ve oyun sonucuna çevirir.
     * Küp satırları çiftlenir (her "Doubles"tan sonra rakibin "Takes"/"Drops" yanıtı);
     * eksik yanıt oyunun akışından üretilir (buildMatXg.actsOf ile aynı mantık).
     *
     * @return array{0: list<array>, 1: array{winner:string,points:int}|null}
     */
    private static function actsAndOutcome(array $rows): array
    {
        $raw = [];
        $outcome = null;
        foreach ($rows as $t) {
            $kind = $t['k'] ?? null;
            $player = ($t['p'] ?? '') === 'W' ? 'white' : 'black';
            if ($kind === 'end') {
                // Kazanan p alanında (ge.winner); puan m sonundaki "Np" değeri.
                $pts = 1;
                if (preg_match('/(\d+)\s*p\b/u', (string) ($t['m'] ?? ''), $mm)) {
                    $pts = max(1, (int) $mm[1]);
                }
                $outcome = ['winner' => $player, 'points' => $pts];

                continue;
            }
            if ($kind === 'cube') {
                $m = (string) ($t['m'] ?? '');
                $chosen = str_contains($m, 'Kabul') ? 'take'
                    : (str_contains($m, 'Pas') ? 'drop'
                    : (((int) ($t['o'] ?? 0)) === -2 ? 'take' : 'double'));
                $raw[] = ['kind' => $chosen, 'player' => $player];

                continue;
            }
            // Hamle turu: zar "6-5" -> KANONİK "65" (yüksek zar önce); notasyon XG lehçesine.
            $dice = self::xgDice((string) ($t['d'] ?? ''));
            $note = trim((string) ($t['m'] ?? ''));
            $moves = ($note !== '' && $note !== 'pas' && $note !== 'pass') ? self::xgMoves($note) : '';
            $raw[] = ['kind' => 'move', 'player' => $player, 'dice' => $dice, 'moves' => $moves];
        }

        // Küp teklif/yanıt çiftleme (buildMatXg.actsOf portu).
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

        // Küp pas -> teklifi kabul etmeyen kaybeder; sonuç 'end' yoksa bundan türetilir.
        if (! $outcome) {
            $cube = 1;
            $dropWinner = null;
            foreach ($out as $a) {
                if ($a['kind'] === 'take') {
                    $cube *= 2;
                } elseif ($a['kind'] === 'drop') {
                    $dropWinner = $a['player'] === 'white' ? 'black' : 'white';
                }
            }
            if ($dropWinner) {
                $outcome = ['winner' => $dropWinner, 'points' => $cube];
            }
        }

        return [$out, $outcome];
    }

    /**
     * KANONİK ZAR NORMALİZASYONU (src/matExport.ts xgDice portu): "6-5"/"56" -> DAİMA yüksek
     * zar önce ("65"). Aynı atış her zaman aynı yazılır -> kaynaktan bağımsız deterministik.
     * SADECE görüntü sırası; hamle token'ları yeniden sıralanmaz. 3+ haneli (dance "6-6-6-6")
     * girdilerde ilk iki zar alınır (buildMatXg ile birebir: dice[0..1]).
     */
    public static function xgDice(string $raw): string
    {
        $digits = preg_replace('/[^1-6]/', '', $raw) ?? '';
        if (strlen($digits) < 2) {
            return $digits;
        }
        $a = (int) $digits[0];
        $b = (int) $digits[1];

        return $a >= $b ? "$a$b" : "$b$a";
    }

    /** Notasyonu XG lehçesine çevir + tekrarları aç (src/matExport.ts xgMoves portu). */
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
