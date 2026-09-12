<?php

namespace App\Support;

/**
 * ZENGİN log ADAPTÖRÜ (MoveLogEntry[] -> ortak oyun modeli -> MatSerializer 'gnubg' lehçesi).
 * Tavlai Luck V1 KALICI kaynağı. Online'da her istemci KENDİ kısmi matchLog'unu gönderir; bu sınıf
 * İKİ oyuncunun logunu BİRLEŞTİRİR (her oyuncunun KENDİ renginin hamleleri kendi logunda TAM) ->
 * TAM maç .mat'i -> gnubg iki oyuncuya da GERÇEK luck verir ("biri 0" bug'ının kalıcı çözümü).
 *
 * Serileştirme (satır kurma, küp-çiftleme, çıktı biçimi) artık MatSerializer'da (TEK KAYNAK). Bu
 * sınıf yalnız KAYNAĞA ÖZGÜ işi yapar: iki-log birleştirme, oyunlara bölme (tahta-reset = isOpening),
 * sonuç türetme (son hamleyi tahtada oynatıp gammon/backgammon çarpanı). Çıktı gnubg NATIVE .mat'tir
 * ve DEĞİŞMEMELİDİR — MatBuilderTest onu commit'li fixture ile BYTE-BYTE karşılaştırır (luck kalkanı).
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

    /** MoveLogEntry[] -> gnubg NATIVE .mat metni (MatSerializer 'gnubg' ile). */
    public static function build(array $log, int $matchLength = 1, string $whiteName = 'White', string $blackName = 'Black'): string
    {
        $model = [];
        foreach (self::segment($log) as $game) {
            $acts = MatSerializer::pairCube(self::rawActs($game));
            $model[] = ['acts' => $acts, 'outcome' => self::outcomeOf($acts)];
        }

        return MatSerializer::render($model, [
            'dialect' => 'gnubg',
            'matchLength' => $matchLength,
            'whiteName' => $whiteName,
            'blackName' => $blackName,
        ]);
    }

    /**
     * Log'u oyunlara böl. Her girdinin OYUN numarası: bir oyuncunun kendi turları oyun içinde
     * ARTAR; seq'in DÜŞÜP 0/1'e inmesi ancak yeni oyunun ilk turunda olur. Ek olarak açılış dizilimi
     * (isOpening = tahta başlangıçta) yeni oyun sınırıdır. seq = turnsPlayed HER oyunda sıfırlanır;
     * log ise maç boyunca birikir -> tek seq'le sıralamak oyunları iç içe geçirir.
     *
     * @return list<list<array>>  oyun-başına giriş listesi
     */
    private static function segment(array $log): array
    {
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

        // fill = yalnız XG dışa aktarımı için tur-sırası dolgusu (zorunlu/dance turlar). gnubg
        // NATIVE .mat + luck bunları İÇERMEZ -> luck bugüne kadarki değerle BİREBİR aynı kalır.
        $entries = [];
        foreach ($log as $e) {
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

        // (oyun, seq)'e göre sırala. AYNI seq içinde: teklif (0) < yanıt (1) < hamle (2).
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

        return $games;
    }

    /**
     * Bir oyunun HAM eylemleri (çiftlenmemiş). move: dice+notation+ENTRY (sonuç için tahta gerekir);
     * cube: yalnız kind. MatSerializer::pairCube ile çiftlenir.
     *
     * @return list<array>
     */
    private static function rawActs(array $game): array
    {
        $raw = [];
        foreach ($game as $e) {
            if (empty($e['player'])) {
                continue;
            }
            if (! empty($e['cube'])) {
                $c = $e['cube']['chosen'] ?? null;
                if ($c === 'double' || $c === 'take' || $c === 'drop') {
                    $raw[] = ['kind' => $c, 'player' => $e['player']];
                }

                continue; // 'no-double' vb. .mat'e yazılmaz
            }
            $raw[] = ['kind' => 'move', 'player' => $e['player'], 'dice' => $e['dice'] ?? [], 'notation' => $e['notation'] ?? '', 'e' => $e];
        }

        return $raw;
    }

    /** Bir oyunun sonucu: küp drop -> teklifi kabul etmeyen kaybeder; yoksa son hamleyi uygulayıp tahtadan. */
    private static function outcomeOf(array $acts): ?array
    {
        $cube = 1;
        $dropWinner = null;
        $last = null;
        foreach ($acts as $a) {
            if ($a['kind'] === 'drop') {
                $dropWinner = self::opp($a['player']);
            } elseif ($a['kind'] === 'take') {
                $cube *= 2;
            } elseif ($a['kind'] === 'move') {
                $last = $a['e'] ?? null;
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

        return ['winner' => $w, 'points' => $cube * Backgammon::gamePoints($state, $w), 'cube' => $cube];
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
