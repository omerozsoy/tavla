<?php

namespace App\Support;

/**
 * src/matExport.ts buildMat'in SUNUCU portu — Tavlai Luck V1 KALICI kaynağı. Online'da her istemci
 * KENDİ kısmi matchLog'unu gönderir (rakip hamleleri snapshot'tan eksik olabilir). Bu sınıf İKİ
 * oyuncunun logunu BİRLEŞTİRİR (her oyuncunun KENDİ renginin hamleleri kendi logunda TAM) -> TAM
 * maç .mat'i -> gnubg iki oyuncuya da GERÇEK luck verir ("biri 0" bug'ının kalıcı çözümü).
 *
 * Tahta konvansiyonu Backgammon.php ile aynı (points[24], +beyaz/-siyah).
 */
class MatBuilder
{
    /** İki oyuncunun logunu TAM maça birleştir: her oyuncunun KENDİ renginin girişleri KENDİ logundan. */
    public static function mergeLogs(array $whiteLog, array $blackLog): array
    {
        $merged = [];
        foreach ($whiteLog as $e) {
            if (($e['player'] ?? null) === 'white') {
                $merged[] = $e;
            }
        }
        foreach ($blackLog as $e) {
            if (($e['player'] ?? null) === 'black') {
                $merged[] = $e;
            }
        }

        return $merged; // build() seq'e göre sıralar
    }

    /** MoveLogEntry[] -> .mat metni (buildMat ile birebir port). */
    public static function build(array $log, int $matchLength = 1, string $whiteName = 'White', string $blackName = 'Black'): string
    {
        $COLW = 34;
        $INIT = Backgammon::initialState()['points'];

        $isOpening = function ($e) use ($INIT) {
            if (! empty($e['cube'])) {
                return false;
            }
            $p = $e['pos'] ?? null;
            if (! is_array($p)) {
                return false;
            }
            $bar = $p['bar'] ?? [];
            $off = $p['off'] ?? [];
            if (($bar['white'] ?? 0) || ($bar['black'] ?? 0) || ($off['white'] ?? 0) || ($off['black'] ?? 0)) {
                return false;
            }
            $pts = $p['points'] ?? [];
            if (count($pts) !== 24) {
                return false;
            }
            for ($i = 0; $i < 24; $i++) {
                if ((int) ($pts[$i] ?? 0) !== (int) $INIT[$i]) {
                    return false;
                }
            }

            return true;
        };

        // Her girdinin OYUN numarası (bkz. src/matExport.ts dosya başı (3)). seq = turnsPlayed ve
        // turnsPlayed HER OYUNDA sıfırlanır (App.resetGameUi); log ise maç boyunca birikir. Tüm maçı
        // tek seq'le sıralamak oyunları İÇ İÇE geçirir (N oyunluk maç -> N-1 boş "Game" başlığı +
        // tek dev bozuk oyun). Bir oyuncunun kendi turları oyun içinde ARTAR; seq'in DÜŞÜP 0/1'e
        // inmesi ancak yeni oyunun ilk turunda olur (küp girdisi turun hamlesiyle AYNI seq'i taşır
        // -> eşitlik sınır sayılmaz, yalnız kesin düşüş).
        $entries = [];
        foreach ($log as $e) {
            // fill = yalnız XG dışa aktarımı için tur-sırası dolgusu (zorunlu/dance turlar). gnubg
            // NATIVE .mat + luck bunları İÇERMEZ -> luck bugüne kadarki değerle BİREBİR aynı kalır.
            if (! empty($e['player']) && empty($e['fill'])) {
                $entries[] = $e;
            }
        }
        $gameNoOf = [];
        $lastSeq = [];
        $g = ['white' => 0, 'black' => 0];
        foreach ($entries as $i => $e) {
            $p = $e['player'];
            $sq = $e['seq'] ?? $i;
            if (isset($lastSeq[$p]) && $sq < $lastSeq[$p] && $sq <= 1) {
                $g[$p] = ($g[$p] ?? 0) + 1;
            }
            $lastSeq[$p] = $sq;
            $gameNoOf[$i] = $g[$p] ?? 0;
        }

        // (oyun, seq)'e göre sırala. AYNI seq içinde: teklif (0) < yanıt (1) < hamle (2) — online
        // birleşik logda doğal sıra "kendi teklifim, kendi hamlem, rakibin kabulü" olur ve satır
        // çiftini bozar (XG: "The game contains some invalid moves").
        $rank = function ($e) {
            if (empty($e['cube'])) {
                return 2;
            }

            return ($e['cube']['chosen'] ?? null) === 'double' ? 0 : 1;
        };
        $indexed = [];
        foreach ($entries as $i => $e) {
            $indexed[] = ['e' => $e, 'i' => $i];
        }
        usort($indexed, function ($a, $b) use ($gameNoOf, $rank) {
            $ga = $gameNoOf[$a['i']] ?? 0;
            $gb = $gameNoOf[$b['i']] ?? 0;
            $sa = $a['e']['seq'] ?? $a['i'];
            $sb = $b['e']['seq'] ?? $b['i'];

            return ($ga <=> $gb) ?: (($sa <=> $sb) ?: (($rank($a['e']) <=> $rank($b['e'])) ?: ($a['i'] <=> $b['i'])));
        });

        $games = [];
        $prevG = -1;
        foreach ($indexed as $it) {
            $e = $it['e'];
            $gn = $gameNoOf[$it['i']] ?? 0;
            if ($isOpening($e) || $gn !== $prevG || count($games) === 0) {
                $games[] = [];
            }
            $prevG = $gn;
            $games[count($games) - 1][] = $e;
        }

        $out = ["$matchLength point match"];
        $sw = 0;
        $sb = 0;
        foreach ($games as $gi => $game) {
            $out[] = '';
            $out[] = ' Game '.($gi + 1);
            $out[] = ' '.str_pad("$whiteName : $sw", $COLW + 4)."$blackName : $sb";

            $acts = self::actsOf($game);

            $rows = [];
            $cube = 1;
            foreach ($acts as $a) {
                if ($a['kind'] === 'move') {
                    $e = $a['e'];
                    $dice = $e['dice'] ?? [];
                    $d = count($dice) >= 2 ? "{$dice[0]}{$dice[1]}" : '  ';
                    $n = $e['notation'] ?? '';
                    $mv = ($n !== '' && $n !== 'pas' && $n !== 'pass') ? $n : '';
                    $text = $mv ? "$d: $mv" : "$d:";
                } elseif ($a['kind'] === 'double') {
                    $text = 'Doubles => '.($cube * 2);
                } elseif ($a['kind'] === 'take') {
                    $cube *= 2;
                    $text = 'Takes';
                } else {
                    $text = 'Drops';
                }
                if ($a['player'] === 'white') {
                    $rows[] = ['w' => $text];
                } else {
                    $li = count($rows) - 1;
                    if ($li >= 0 && array_key_exists('w', $rows[$li]) && ! array_key_exists('b', $rows[$li])) {
                        $rows[$li]['b'] = $text;
                    } else {
                        $rows[] = ['b' => $text];
                    }
                }
            }
            foreach ($rows as $idx => $r) {
                $left = str_pad($r['w'] ?? '', $COLW);
                $out[] = rtrim(sprintf('%3d) %s%s', $idx + 1, $left, $r['b'] ?? ''));
            }

            $oc = self::outcomeOf($acts);
            if ($oc) {
                $pts = $oc['points'];
                if ($matchLength > 0) {
                    $need = $matchLength - ($oc['winner'] === 'white' ? $sw : $sb);
                    if ($need > 0) {
                        $pts = min($pts, $need);
                    }
                }
                $winTxt = "Wins $pts point".($pts === 1 ? '' : 's');
                $out[] = $oc['winner'] === 'white' ? "      $winTxt" : '      '.str_pad('', $COLW).$winTxt;
                if ($oc['winner'] === 'white') {
                    $sw += $pts;
                } else {
                    $sb += $pts;
                }
            }
        }

        return implode("\n", $out)."\n";
    }

    /**
     * Bir oyunun eylem dizisi. Küp satırları ÇİFTLENİR: her "Doubles"ın hemen ardından rakibin
     * "Takes"/"Drops" yanıtı gelir. Eksik kayıt (rakibin istemcisi senkron gönderemedi) oyunun
     * devamından ÜRETİLİR — askıda kalan küp satırı .mat'i bozar (XG: "invalid moves").
     */
    private static function actsOf(array $game): array
    {
        $raw = [];
        foreach ($game as $e) {
            if (empty($e['player'])) {
                continue;
            }
            if (! empty($e['cube'])) {
                $c = $e['cube']['chosen'] ?? null;
                if ($c === 'double' || $c === 'take' || $c === 'drop') {
                    $raw[] = ['kind' => $c, 'player' => $e['player'], 'e' => $e];
                }

                continue; // 'no-double' vb. .mat'e yazılmaz (küp eylemi gerçekleşmemiş)
            }
            $raw[] = ['kind' => 'move', 'player' => $e['player'], 'e' => $e];
        }

        $out = [];
        $pending = null; // yanıt bekleyen teklif
        $answer = function (string $kind) use (&$out, &$pending) {
            if (! $pending) {
                return;
            }
            $out[] = ['kind' => $kind, 'player' => self::opp($pending['player']), 'e' => null];
            $pending = null;
        };
        foreach ($raw as $a) {
            if ($a['kind'] === 'double') {
                $answer('take'); // önceki teklif cevapsız kaldıysa: oyun sürdüğüne göre kabul edilmiş
                $out[] = $a;
                $pending = $a;

                continue;
            }
            if ($a['kind'] === 'take' || $a['kind'] === 'drop') {
                if (! $pending || $pending['player'] !== self::opp($a['player'])) {
                    // Teklif kaydı eksik -> rakip adına üret ki küp değeri ve satır çifti korunsun
                    $out[] = ['kind' => 'double', 'player' => self::opp($a['player']), 'e' => null];
                }
                $pending = null;
                $out[] = $a;

                continue;
            }
            $answer('take'); // hamle geldiyse teklif kabul edilmiş demektir
            $out[] = $a;
        }
        $answer('drop'); // oyun teklifin ardından bittiyse: pas

        return $out;
    }

    /** Bir oyunun sonucu: küp drop -> teklifi kabul etmeyen kaybeder; yoksa son hamleyi uygulayıp tahtadan. */
    private static function outcomeOf(array $acts): ?array
    {
        $cube = 1;
        $dropWinner = null;
        $last = null;
        foreach ($acts as $a) {
            // Küp yalnızca KABUL edilince (take) katlanır; teklif + kabul ayrı satırlar olduğundan
            // ikisinde de katlarsak x4 olurdu.
            if ($a['kind'] === 'drop') {
                $dropWinner = self::opp($a['player']);
            } elseif ($a['kind'] === 'take') {
                $cube *= 2;
            } elseif ($a['kind'] === 'move') {
                $last = $a['e'];
            }
        }
        if ($dropWinner) {
            return ['winner' => $dropWinner, 'points' => $cube];
        }
        if (! $last || empty($last['player']) || empty($last['pos'])) {
            return null;
        }
        $state = self::applySteps($last['pos'], $last['playedSteps'] ?? $last['steps'] ?? [], $last['player']);
        $w = Backgammon::winner($state);
        if (! $w) {
            return null;
        }

        return ['winner' => $w, 'points' => $cube * Backgammon::gamePoints($state, $w)];
    }

    private static function opp(string $p): string
    {
        return $p === 'white' ? 'black' : 'white';
    }

    /** Step'leri bir pos'a uygula -> final state (points/bar/off). Tekli vuruş bar'a gönderir. */
    private static function applySteps(array $pos, array $steps, string $player): array
    {
        $state = [
            'points' => array_map('intval', array_values($pos['points'] ?? [])),
            'bar' => ['white' => (int) ($pos['bar']['white'] ?? 0), 'black' => (int) ($pos['bar']['black'] ?? 0)],
            'off' => ['white' => (int) ($pos['off']['white'] ?? 0), 'black' => (int) ($pos['off']['black'] ?? 0)],
        ];
        $sign = $player === 'white' ? 1 : -1;
        $opp = self::opp($player);
        foreach ($steps as $st) {
            $from = $st['from'] ?? null;
            $to = $st['to'] ?? null;
            // kaynaktan çıkar
            if ($from === 'bar') {
                $state['bar'][$player]--;
            } elseif ($from !== null) {
                $state['points'][(int) $from] -= $sign;
            }
            // hedefe koy
            if ($to === 'off') {
                $state['off'][$player]++;
            } elseif ($to !== null) {
                $ti = (int) $to;
                $cur = (int) ($state['points'][$ti] ?? 0);
                if ($sign > 0 && $cur === -1) { // beyaz tekli siyahı vurur
                    $state['points'][$ti] = 0;
                    $state['bar'][$opp]++;
                } elseif ($sign < 0 && $cur === 1) { // siyah tekli beyazı vurur
                    $state['points'][$ti] = 0;
                    $state['bar'][$opp]++;
                }
                $state['points'][$ti] += $sign;
            }
        }

        return $state;
    }
}
