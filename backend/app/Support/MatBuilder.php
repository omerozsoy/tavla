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

        // seq'e göre STABIL sırala (aynı seq -> orijinal sıra; PHP 8 usort stabil).
        $indexed = [];
        foreach ($log as $i => $e) {
            $indexed[] = ['e' => $e, 'i' => $i];
        }
        usort($indexed, function ($a, $b) {
            $sa = $a['e']['seq'] ?? $a['i'];
            $sb = $b['e']['seq'] ?? $b['i'];

            return $sa <=> $sb ?: $a['i'] <=> $b['i'];
        });

        $games = [];
        foreach ($indexed as $it) {
            $e = $it['e'];
            if ($isOpening($e) || count($games) === 0) {
                $games[] = [];
            }
            $games[count($games) - 1][] = $e;
        }

        $out = ["$matchLength point match"];
        $sw = 0;
        $sb = 0;
        foreach ($games as $gi => $game) {
            $out[] = '';
            $out[] = ' Game '.($gi + 1);
            $out[] = ' '.str_pad("$whiteName : $sw", $COLW + 4)."$blackName : $sb";

            $rows = [];
            $cube = 1;
            foreach ($game as $e) {
                if (empty($e['player'])) {
                    continue;
                }
                if (! empty($e['cube'])) {
                    $chosen = $e['cube']['chosen'] ?? null;
                    if ($chosen === 'double') {
                        $text = 'Doubles => '.($cube * 2);
                    } elseif ($chosen === 'take') {
                        $cube *= 2;
                        $text = 'Takes';
                    } elseif ($chosen === 'drop') {
                        $text = 'Drops';
                    } else {
                        continue;
                    }
                } else {
                    $dice = $e['dice'] ?? [];
                    $d = count($dice) >= 2 ? "{$dice[0]}{$dice[1]}" : '  ';
                    $n = $e['notation'] ?? '';
                    $mv = ($n !== '' && $n !== 'pas' && $n !== 'pass') ? $n : '';
                    $text = $mv ? "$d: $mv" : "$d:";
                }
                if ($e['player'] === 'white') {
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

            $oc = self::outcomeOf($game);
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

    /** Bir oyunun sonucu: küp drop -> teklifi kabul etmeyen kaybeder; yoksa son hamleyi uygulayıp tahtadan. */
    private static function outcomeOf(array $game): ?array
    {
        $cube = 1;
        $dropWinner = null;
        $last = null;
        foreach ($game as $e) {
            if (! empty($e['cube'])) {
                $chosen = $e['cube']['chosen'] ?? null;
                if ($chosen === 'drop') {
                    $dropWinner = ! empty($e['player']) ? self::opp($e['player']) : null;
                } elseif ($chosen === 'take') {
                    $cube *= 2;
                }
            } elseif (! empty($e['player'])) {
                $last = $e;
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
