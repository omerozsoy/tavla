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
        $decisions = 0;
        $evaluated = 0;
        $skipped = 0;
        $per = [];

        foreach ($log as $e) {
            if (($e['player'] ?? null) !== $player) {
                continue;
            }
            if (! empty($e['cube'])) {
                continue; // cube kararlari v2
            }
            if (empty($e['pos']) || empty($e['playedSteps']) || empty($e['dice'])) {
                $skipped++;

                continue;
            }
            $pos = $e['pos'];
            $res = $this->gnubg->analyze([
                'points' => $pos['points'],
                'bar' => $pos['bar'] ?? ['white' => 0, 'black' => 0],
                'turn' => $player,
                'dice' => array_values($e['dice']),
                'matchLength' => $matchLength,
                'plies' => $plies,
                'playedSteps' => $e['playedSteps'],
            ]);
            if ($res === null) {
                $skipped++;

                continue;
            }
            $cand = $res['result']['hint'] ?? [];
            $played = $res['played'] ?? null;
            if (! is_array($played) || ! isset($played['loss'])) {
                $skipped++;

                continue;
            }
            $evaluated++;

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

        $pr = $decisions > 0 ? ($loss / $decisions) * 500 : null;

        return [
            'pr' => $pr,
            'loss' => $loss,
            'decisions' => $decisions,
            'evaluated' => $evaluated,
            'skipped' => $skipped,
            'perDecision' => $per,
        ];
    }
}
