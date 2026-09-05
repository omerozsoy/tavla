<?php

namespace App\Services\Analysis;

use App\Services\GnuBg\GnuBgClient;

/**
 * Analiz orkestratoru — bir macin logunu gnubg ile isleyip PR uretir (GNU-only mimari).
 *
 * v1: checker PR, money temeli (matchLength 0 -> skor-bagimsiz), Fast/Deep tek ply.
 * Sonraki: match-aware EMG (karar-basi skor), cube PR, Fast->Deep->Rollout tirmanma.
 *
 * Her karar icin gnubg /analyze cagrilir: en iyi + oynanan hamlenin equity kaybi (loss).
 * XG: zorunlu (tek yasal hamle) ve obvious (en iyi-en kotu spread < esik) kararlar PR paydasi disi.
 * PR = (sayilan kararlarin toplam loss / sayilan karar) * 500.
 */
class AnalysisOrchestrator
{
    // XG obvious esigi (src/analysis/pr.ts ile ayni).
    private const OBVIOUS = 0.001;

    public function __construct(private GnuBgClient $gnubg) {}

    /**
     * @param  array  $log  reportRating log dizisi (entry: player,pos,dice,playedSteps,cube...)
     * @param  string  $player  'white'|'black' — PR'i hesaplanacak oyuncu
     * @param  int  $matchLength  0 = money (v1); ileride gercek mac uzunlugu + skor
     * @return array{pr:?float,loss:float,decisions:int,evaluated:int,skipped:int,perDecision:array}
     */
    public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2): array
    {
        $loss = 0.0;
        $allLoss = 0.0; // TUM degerlendirilen kararlarin loss'u (loose PR yedegi -> PR asla null olmaz)
        $decisions = 0;
        $evaluated = 0;
        $skipped = 0;
        $per = [];
        $reasons = ['no_content' => 0, 'gnubg_null' => 0, 'no_match' => 0];
        $firstSkip = null;

        foreach ($log as $e) {
            if (($e['player'] ?? null) !== $player) {
                continue;
            }
            if (! empty($e['cube'])) {
                continue; // cube kararlari v2
            }
            if (empty($e['pos']) || empty($e['playedSteps']) || empty($e['dice'])) {
                $skipped++;
                $reasons['no_content']++;
                if ($firstSkip === null) {
                    $firstSkip = ['why' => 'no_content', 'entry_keys' => array_keys($e),
                        'has_pos' => ! empty($e['pos']), 'has_playedSteps' => ! empty($e['playedSteps']),
                        'has_dice' => ! empty($e['dice']),
                        'pos_keys' => isset($e['pos']) && is_array($e['pos']) ? array_keys($e['pos']) : null];
                }

                continue;
            }
            $pos = $e['pos'];
            $mctx = $e['mctx'] ?? null; // karar anındaki maç bağlamı (istemci ekler; eski loglarda yok)
            $structured = [
                'points' => $pos['points'],
                'bar' => $pos['bar'] ?? ['white' => 0, 'black' => 0],
                'turn' => $player,
                'dice' => array_values($e['dice']),
                'matchLength' => is_array($mctx) ? (int) ($mctx['matchLen'] ?? $matchLength) : $matchLength,
                'plies' => $plies,
                'playedSteps' => $e['playedSteps'],
            ];
            // Match-aware EMG: mctx varsa karar anındaki skor/küp/crawford -> gnubg doğru match equity.
            // Yoksa money (skor-bağımsız) fallback -> PR yine üretilir (eski loglar bozulmaz).
            if (is_array($mctx)) {
                if (isset($mctx['score'])) {
                    $structured['score'] = $mctx['score'];
                }
                $structured['cube'] = ['value' => (int) ($mctx['cube'] ?? 1), 'owner' => $mctx['cubeOwner'] ?? null];
                $structured['crawford'] = (bool) ($mctx['crawford'] ?? false);
            }
            $res = $this->gnubg->analyze($structured);
            if ($res === null) {
                $skipped++;
                $reasons['gnubg_null']++;
                if ($firstSkip === null) {
                    $firstSkip = ['why' => 'gnubg_null'];
                }

                continue;
            }
            $cand = $res['result']['hint'] ?? [];
            $played = $res['played'] ?? null;
            if (! is_array($played) || ! isset($played['loss'])) {
                $skipped++;
                $reasons['no_match']++;
                if ($firstSkip === null) {
                    $firstSkip = ['why' => 'no_match', 'played' => $played, 'cand_count' => count($cand),
                        'dice' => array_values($e['dice']), 'playedSteps' => $e['playedSteps']];
                }

                continue;
            }
            $evaluated++;
            $allLoss += (float) $played['loss'];

            $legal = count($cand);
            $bestEq = $cand[0]['equity'] ?? 0.0;
            $worstEq = $legal > 0 ? ($cand[$legal - 1]['equity'] ?? $bestEq) : $bestEq;
            $counts = $legal > 1 && abs($bestEq - $worstEq) >= self::OBVIOUS;
            if ($counts) {
                $loss += (float) $played['loss'];
                $decisions++;
            }
            $per[] = [
                'move' => $played['move'] ?? null,
                'loss' => round((float) $played['loss'], 4),
                'counts' => $counts,
            ];
        }

        // DIREKTIF: PR ASLA null olmasin. Once strict (sayilan kararlar); yoksa loose (tum
        // degerlendirilen kararlar); yoksa 0. Boylece maç-sonu/istatistikte hicbir zaman bos gorunmez.
        $strictPr = $decisions > 0 ? ($loss / $decisions) * 500 : null;
        $loosePr = $evaluated > 0 ? ($allLoss / $evaluated) * 500 : null;
        $pr = $strictPr ?? $loosePr ?? 0.0;

        return [
            'pr' => $pr,                 // asla null
            'strictPr' => $strictPr,     // seffaflik: sayilan kararlardan (null olabilir)
            'loosePr' => $loosePr,       // degerlendirilen tum kararlardan (null olabilir)
            'loss' => $loss,
            'decisions' => $decisions,
            'evaluated' => $evaluated,
            'skipped' => $skipped,
            'skipReasons' => $reasons,
            'firstSkip' => $firstSkip,
            'perDecision' => $per,
        ];
    }

    /**
     * KÜP PR (double/no-double/take/drop). gnubg cube analizi (3 aksiyon equity'si) -> XG kaybı.
     * Küp girdileri: e['cube']['chosen'] + e['pos'] (doubler on-roll). PR asla null.
     *
     * @return array{pr:float,strictPr:?float,loosePr:?float,loss:float,decisions:int,evaluated:int,skipped:int,perDecision:array}
     */
    public function cubePr(array $log, string $player, int $matchLength = 0): array
    {
        $loss = 0.0;
        $allLoss = 0.0;
        $decisions = 0;
        $evaluated = 0;
        $skipped = 0;
        $per = [];

        foreach ($log as $e) {
            if (($e['player'] ?? null) !== $player) {
                continue;
            }
            if (empty($e['cube']) || empty($e['pos'])) {
                continue;
            }
            $chosen = $e['cube']['chosen'] ?? null;
            if (! in_array($chosen, ['double', 'no-double', 'take', 'drop'], true)) {
                $skipped++;

                continue;
            }
            $pos = $e['pos'];
            $mctx = $e['mctx'] ?? null;
            $structured = [
                'points' => $pos['points'],
                'bar' => $pos['bar'] ?? ['white' => 0, 'black' => 0],
                'turn' => $pos['turn'] ?? $player, // küp kararında pozisyon doubler'ın (on-roll)
                'dice' => [], // küp kararı -> zar yok
                'matchLength' => is_array($mctx) ? (int) ($mctx['matchLen'] ?? $matchLength) : $matchLength,
            ];
            if (is_array($mctx)) {
                if (isset($mctx['score'])) {
                    $structured['score'] = $mctx['score'];
                }
                $structured['cube'] = ['value' => (int) ($mctx['cube'] ?? 1), 'owner' => $mctx['cubeOwner'] ?? null];
                $structured['crawford'] = (bool) ($mctx['crawford'] ?? false);
            }
            $res = $this->gnubg->analyze($structured);
            $eq = $res['cube']['equities'] ?? null;
            if (! is_array($eq) || ! isset($eq['noDouble'], $eq['doubleTake'], $eq['doublePass'])) {
                $skipped++;

                continue;
            }
            $evaluated++;
            [$lossVal, $counts] = $this->cubeLoss($chosen, (float) $eq['noDouble'], (float) $eq['doubleTake'], (float) $eq['doublePass']);
            $allLoss += $lossVal;
            if ($counts) {
                $loss += $lossVal;
                $decisions++;
            }
            $per[] = ['chosen' => $chosen, 'loss' => round($lossVal, 4), 'counts' => $counts];
        }

        $strict = $decisions > 0 ? ($loss / $decisions) * 500 : null;
        $loose = $evaluated > 0 ? ($allLoss / $evaluated) * 500 : null;

        return [
            'pr' => $strict ?? $loose ?? 0.0,
            'strictPr' => $strict,
            'loosePr' => $loose,
            'loss' => $loss,
            'decisions' => $decisions,
            'evaluated' => $evaluated,
            'skipped' => $skipped,
            'perDecision' => $per,
        ];
    }

    /**
     * Küp aksiyonu equity kaybı (XG). gnubg equity'leri doubler perspektifi:
     *   noDouble, doubleTake, doublePass. Teklif: Double = min(take,pass) [rakip en kötüyü seçer].
     *   Yanıt (take/drop): rakip perspektifi -> take = -doubleTake, pass = -1.
     *
     * @return array{0:float,1:bool} [loss, countsForPR]
     */
    private function cubeLoss(string $chosen, float $noDouble, float $doubleTake, float $doublePass): array
    {
        if ($chosen === 'double' || $chosen === 'no-double') {
            $doubleVal = min($doubleTake, $doublePass); // rakip optimal yanıt (doubler için en kötü)
            $best = max($noDouble, $doubleVal);
            $worst = min($noDouble, $doubleVal);
            $chosenVal = $chosen === 'double' ? $doubleVal : $noDouble;
        } else { // take / drop -> yanıt veren (rakip) perspektifi
            $takeVal = -$doubleTake;
            $passVal = -1.0;
            $best = max($takeVal, $passVal);
            $worst = min($takeVal, $passVal);
            $chosenVal = $chosen === 'take' ? $takeVal : $passVal;
        }

        return [max(0.0, $best - $chosenVal), abs($best - $worst) >= self::OBVIOUS];
    }
}
