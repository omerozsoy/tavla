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
    public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2, ?callable $onProgress = null): array
    {
        $loss = 0.0;
        $allLoss = 0.0; // TUM degerlendirilen kararlarin loss'u (loose PR yedegi -> PR asla null olmaz)
        $decisions = 0;
        $evaluated = 0;
        $skipped = 0;
        $per = [];
        $reasons = ['no_content' => 0, 'gnubg_null' => 0, 'no_match' => 0];
        $firstSkip = null;
        $jobs = []; // PR HIZLANDIRMA: önce TÜM kararları topla, sonra havuza PARALEL analiz et (aşağıda)

        foreach ($log as $logIndex => $e) {
            if (($e['player'] ?? null) !== $player) {
                continue;
            }
            if (! empty($e['fill'])) {
                continue; // fill = XG .mat tur-sırası dolgusu (zorunlu/dance); karar DEĞİL, PR'a girmez
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
            $jobs[$logIndex] = ['s' => $structured, 'e' => $e];
        }

        // TÜM kararları havuza PARALEL analiz et -> tek maçın ~60 kararı sıralı (~15sn) yerine
        // instance sayısı kadar hızlı (6 instance ≈ 6×). Sonuçlar log sırasında işlenir (PR aynı).
        // $onProgress: pencere (chunk) bitince "N pozisyon analiz edildi" bildirir (PR ilerleme çubuğu).
        $results = $this->gnubg->analyzeBackgroundBatch(array_map(fn ($j) => $j['s'], $jobs), $onProgress);

        foreach ($jobs as $logIndex => $job) {
            $e = $job['e'];
            $res = $results[$logIndex] ?? null;
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
            $lossVal = (float) $played['loss'];
            $per[] = [
                'move' => $played['move'] ?? null,
                'loss' => round($lossVal, 4),
                'counts' => $counts,
                'logIndex' => $logIndex, // Hata Günlüğü: gnubg loss'unu orijinal log girdisine eşler
                // XG karşılaştırma tablosu (tavla:gnubg-pr) için ek sütunlar:
                'dice' => array_values($e['dice']),
                'bestMove' => $cand[0]['move'] ?? null,
                // Hata Günlüğü "Alternatif En İyi Hamleler" (gnubg ilk 3 aday).
                'cands' => array_values(array_map(
                    fn ($c) => ['notation' => (string) ($c['move'] ?? ''), 'equity' => round((float) ($c['equity'] ?? 0), 4)],
                    array_slice(array_filter($cand, 'is_array'), 0, 3),
                )),
                'bestEquity' => round((float) $bestEq, 4),
                'playedEquity' => round((float) $bestEq - $lossVal, 4),
                'legal' => $legal,
                'forced' => $legal <= 1,
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
     * İLERLEME ÇUBUĞU için: bu oyuncunun gnubg'ye GÖNDERİLECEK pozisyon sayısı (checker + cube).
     * Yüzde = analiz edilen / bu toplam. Predikatlar checkerPr/cubePr'daki $jobs filtreleriyle
     * BİREBİR aynı olmalı (gnubg'ye giden küme); değişirlerse burası da güncellenmeli.
     */
    public function countPositions(array $log, string $player): int
    {
        $n = 0;
        foreach ($log as $e) {
            if (($e['player'] ?? null) !== $player) {
                continue;
            }
            // KÜP kararı (checkerPr'da $jobs'a girmez; cubePr'da girer).
            if (! empty($e['cube'])) {
                if (! empty($e['pos'])
                    && in_array($e['cube']['chosen'] ?? null, ['double', 'no-double', 'take', 'drop'], true)) {
                    $n++;
                }

                continue;
            }
            // CHECKER hamlesi: fill değil + pos+playedSteps+dice dolu (checkerPr $jobs filtresi).
            if (empty($e['fill']) && ! empty($e['pos']) && ! empty($e['playedSteps']) && ! empty($e['dice'])) {
                $n++;
            }
        }

        return $n;
    }

    /**
     * KÜP PR (double/no-double/take/drop). gnubg cube analizi (3 aksiyon equity'si) -> XG kaybı.
     * Küp girdileri: e['cube']['chosen'] + e['pos'] (doubler on-roll). PR asla null.
     *
     * @return array{pr:float,strictPr:?float,loosePr:?float,loss:float,decisions:int,evaluated:int,skipped:int,perDecision:array}
     */
    public function cubePr(array $log, string $player, int $matchLength = 0, ?callable $onProgress = null): array
    {
        $loss = 0.0;
        $allLoss = 0.0;
        $decisions = 0;
        $evaluated = 0;
        $skipped = 0;
        $per = [];
        $jobs = []; // PR HIZLANDIRMA: önce TÜM küp kararlarını topla, sonra havuza PARALEL analiz et

        foreach ($log as $logIndex => $e) {
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
            $jobs[$logIndex] = ['s' => $structured, 'chosen' => $chosen];
        }

        // Küp kararlarını da havuza PARALEL analiz et (checker ile aynı mantık; PR değişmez).
        $results = $this->gnubg->analyzeBackgroundBatch(array_map(fn ($j) => $j['s'], $jobs), $onProgress);

        foreach ($jobs as $logIndex => $job) {
            $chosen = $job['chosen'];
            $res = $results[$logIndex] ?? null;
            $eq = is_array($res) ? ($res['cube']['equities'] ?? null) : null;
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

    /**
     * PR'ı gnubg_review (reviewMatch) LOG'undan TÜRET — ayrı per-pozisyon checkerPr/cubePr yeniden-analizine
     * GEREK YOK. reviewMatch tam .mat (SUNUCU match_moves) ile tek seferde DOĞRU per-karar değer üretir;
     * cubePr'ın per-pozisyon /analyze yolu küp kararlarında runtime hatalı sonuç veriyordu (EU6CD: kusursuz
     * oyuncuya cube_pr 67.67 — review DOĞRU 0.021). reviewMatch cands'ı TAM (kırpık değil) -> obvious eşiği
     * (best-worst spread >= OBVIOUS) birebir uygulanır; küp equity'leri (noDouble/doubleTake/doublePass) de tam.
     * Böylece tüm raporlar SADECE sunucu verisiyle + DOĞRU hesaplanır (kullanıcı direktifi).
     *
     * @param  array  $reviewLog  gnubg_review['log'] dizisi
     * @param  string  $player  'white'|'black'
     * @return array{pr:float,checker_pr:?float,cube_pr:?float,equity_lost:float,decisions:int,checker_decisions:int,cube_decisions:int}
     */
    public function prFromReviewLog(array $reviewLog, string $player): array
    {
        $chkLoss = 0.0;
        $chkDec = 0;
        $cubeLossSum = 0.0;
        $cubeDec = 0;
        foreach ($reviewLog as $e) {
            if (($e['player'] ?? null) !== $player) {
                continue;
            }
            // KÜP kararı (double/no-double/take/drop): cubeLoss AYNI formül, ama equity'ler REVIEW'DAN (doğru).
            if (isset($e['cube']['chosen'])) {
                $eq = $e['cube']['equities'] ?? null;
                if (! is_array($eq) || ! isset($eq['noDouble'], $eq['doubleTake'], $eq['doublePass'])) {
                    continue;
                }
                [$lv, $counts] = $this->cubeLoss(
                    (string) $e['cube']['chosen'],
                    (float) $eq['noDouble'], (float) $eq['doubleTake'], (float) $eq['doublePass']
                );
                if ($counts) {
                    $cubeLossSum += $lv;
                    $cubeDec++;
                }

                continue;
            }
            // CHECKER hamlesi: fill (tur-sırası dolgu/dance) ve zorunlu (tek aday) PR'a girmez.
            if (! empty($e['fill'])) {
                continue;
            }
            $cands = $e['cands'] ?? null;
            if (! is_array($cands) || count($cands) < 2) {
                continue; // tek yasal hamle = zorunlu -> sayılmaz
            }
            $eqs = array_map(static fn ($c) => (float) ($c['equity'] ?? 0), $cands);
            if ((max($eqs) - min($eqs)) < self::OBVIOUS) {
                continue; // obvious (en iyi-en kötü spread < eşik) -> sayılmaz
            }
            $chkLoss += max(0.0, (float) ($e['loss'] ?? 0));
            $chkDec++;
        }
        $loss = $chkLoss + $cubeLossSum;
        $dec = $chkDec + $cubeDec;

        return [
            'pr' => $dec > 0 ? ($loss / $dec) * 500 : 0.0,
            'checker_pr' => $chkDec > 0 ? ($chkLoss / $chkDec) * 500 : null,
            'cube_pr' => $cubeDec > 0 ? ($cubeLossSum / $cubeDec) * 500 : null,
            'equity_lost' => $loss,
            'decisions' => $dec,
            'checker_decisions' => $chkDec,
            'cube_decisions' => $cubeDec,
        ];
    }
}
