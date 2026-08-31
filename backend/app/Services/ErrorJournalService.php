<?php

namespace App\Services;

use App\Analysis\PositionClassifier;
use App\Analysis\PositionFeatureExtractor;
use App\Models\DecisionAnalysis;
use App\Models\MatchResult;
use App\Models\User;
use App\Support\ErrorJournalConfig as Cfg;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Hata Gunlugu servisi (brief §1-24).
 *
 * Kaynak: match_results.log (tarayici WildBG analizi — her karar pos+dice+best+loss).
 * Bu servis MOTOR CALISTIRMAZ; log'daki hazir equity/loss'u kullanir, ek olarak
 * pozisyon siniflandirmasi + pip cikarir ve decision_analyses'e yazar (dedupe).
 * Gunluk ozet/errorRate bu tablodan SQL ile toplanir.
 *
 * "Karar" = insanin (log.hc) forced-olmayan checker kararidir. Cube kararlari v1'de
 * kategori kirilimina dahil edilmez (brief §3: checker/cube karistirma).
 */
class ErrorJournalService
{
    /**
     * Bir maci analiz edip decision_analyses'i (yeniden) uretir. Idempotent.
     * @return int islenen karar sayisi
     */
    public function analyzeMatch(MatchResult $mr, bool $force = false): int
    {
        // Zaten guncel surumle islenmisse atla.
        if (! $force && $mr->analyzed_at !== null && (int) $mr->analysis_version === Cfg::ANALYSIS_VERSION) {
            return 0;
        }

        $entries = $this->parseLog($mr->log);
        if ($entries === null) {
            $this->markAnalyzed($mr, 0);

            return 0;
        }

        [$hc, $rows] = $entries;
        $playedAt = $mr->created_at ?? Carbon::now();

        $count = DB::transaction(function () use ($mr, $hc, $rows, $playedAt) {
            // Temiz yeniden uretim: bu macin eski analizlerini sil, yenilerini yaz.
            DecisionAnalysis::where('match_result_id', $mr->id)->delete();

            $prevByPlayer = [];
            $n = 0;
            foreach ($rows as $i => $e) {
                if (! is_array($e) || isset($e['cube'])) {
                    continue; // cube karari -> v1 disi
                }
                $player = $e['player'] ?? null;
                if ($player === null) {
                    continue;
                }
                // Rakip (pvb'de bot) karari da saklanir: Zar Ortalamalari Sen/Rakip kirilimi.
                // Hata Gunlugu bu satirlari HARIC tutar (bkz. scoped()).
                $isOpponent = $hc !== null && $player !== $hc;
                $pos = $e['pos'] ?? null;
                if (! is_array($pos) || ! isset($pos['points'])) {
                    continue;
                }

                $loss = (float) ($e['loss'] ?? 0);
                $severity = Cfg::severity($loss);        // null = hata degil
                $isError = $severity !== null;

                $prev = $prevByPlayer[$player] ?? null;
                $f = PositionFeatureExtractor::extract($pos, $player, $i);
                $cls = PositionClassifier::classify($f, $player, $prev);
                $prevByPlayer[$player] = $cls['primaryCategory'];

                $bestEq = isset($e['cands'][0]['equity']) ? (float) $e['cands'][0]['equity'] : null;
                $playedEq = $bestEq !== null ? $bestEq - $loss : null;

                DecisionAnalysis::create([
                    'user_id' => $mr->user_id,
                    'match_result_id' => $mr->id,
                    'move_index' => $i,
                    'played_at' => $playedAt,
                    'player' => $player,
                    'is_opponent' => $isOpponent,
                    'decision_type' => 'checker',
                    'dice' => $this->diceStr($e['dice'] ?? null),
                    'played' => isset($e['notation']) ? mb_substr((string) $e['notation'], 0, 40) : null,
                    'best' => isset($e['best']) ? mb_substr((string) $e['best'], 0, 40) : null,
                    'played_equity' => $playedEq,
                    'best_equity' => $bestEq,
                    'equity_loss' => $loss,
                    'severity' => $severity,
                    'primary_category' => $cls['primaryCategory'],
                    'category_tags' => $cls['tags'],
                    'my_pip' => $f['myPipCount'],
                    'opp_pip' => $f['opponentPipCount'],
                    // Agir JSON yalniz HATALAR icin (board onizleme). Perfect kararlar sadece payda.
                    'pos' => $isError ? json_encode($pos) : null,
                    'steps' => $isError ? json_encode($e['steps'] ?? []) : null,
                    'played_steps' => $isError ? json_encode($e['playedSteps'] ?? []) : null,
                    'cands' => $isError ? json_encode(array_slice($e['cands'] ?? [], 0, 3)) : null,
                    'engine_version' => 'wildbg',
                    'analysis_version' => Cfg::ANALYSIS_VERSION,
                ]);
                $n++;
            }

            return $n;
        });

        $this->markAnalyzed($mr, $count);

        return $count;
    }

    /**
     * Gunluk ozet (brief §24). $from/$to null ise tum zaman.
     * @return array DailyErrorSummary govdesi
     */
    public function summary(User $user, ?Carbon $from, ?Carbon $to): array
    {
        $base = fn () => $this->scoped($user->id, $from, $to);

        $decisionsAnalyzed = (int) $base()->count();
        $gamesAnalyzed = (int) $base()->distinct('match_result_id')->count('match_result_id');

        $sev = $base()->whereNotNull('severity')
            ->selectRaw('severity, count(*) c, sum(equity_loss) loss')
            ->groupBy('severity')->get()->keyBy('severity');

        $inacc = (int) ($sev['inaccuracy']->c ?? 0);
        $mist = (int) ($sev['mistake']->c ?? 0);
        $blun = (int) ($sev['blunder']->c ?? 0);
        $totalErrors = $inacc + $mist + $blun;
        $totalLoss = (float) ($sev->sum(fn ($r) => (float) $r->loss));
        $avgLoss = $totalErrors > 0 ? $totalLoss / $totalErrors : 0.0;

        $cats = $base()
            ->selectRaw('primary_category, count(*) decisions, '
                .'sum(case when severity is not null then 1 else 0 end) errors, '
                .'sum(case when severity is not null then equity_loss else 0 end) equity_loss')
            ->groupBy('primary_category')->get()
            ->map(fn ($r) => [
                'category' => $r->primary_category,
                'decisions' => (int) $r->decisions,
                'errors' => (int) $r->errors,
                'errorRate' => (int) $r->decisions > 0 ? round((int) $r->errors / (int) $r->decisions, 4) : 0.0,
                'equityLoss' => round((float) $r->equity_loss, 4),
            ])->values()->all();

        return [
            'gamesAnalyzed' => $gamesAnalyzed,
            'decisionsAnalyzed' => $decisionsAnalyzed,
            'totalErrors' => $totalErrors,
            'inaccuracies' => $inacc,
            'mistakes' => $mist,
            'blunders' => $blun,
            'totalEquityLoss' => round($totalLoss, 4),
            'averageEquityLoss' => round($avgLoss, 4),
            'categories' => $cats,
        ];
    }

    /**
     * Son hatalar / kategori hatalari (brief §30-31). Yalniz hata olan kararlar.
     * @return array<array> ErrorJournalEntry listesi
     */
    public function errors(User $user, ?Carbon $from, ?Carbon $to, ?string $category = null, int $limit = 50): array
    {
        $q = $this->scoped($user->id, $from, $to)->whereNotNull('severity');
        if ($category !== null) {
            $q->where('primary_category', $category);
        }

        return $q->orderByDesc('played_at')->orderByDesc('equity_loss')
            ->limit($limit)->get()
            ->map(fn (DecisionAnalysis $d) => $this->entryJson($d))->all();
    }

    // --- yardimcilar ---------------------------------------------------------

    /** user + tarih araligi ile filtrelenmis checker-karari sorgusu (RAKIP haric). */
    private function scoped(int $userId, ?Carbon $from, ?Carbon $to)
    {
        $q = DecisionAnalysis::where('user_id', $userId)
            ->where('decision_type', 'checker')
            ->where('is_opponent', false); // Hata Gunlugu yalniz kullanicinin kararlari
        if ($from) {
            $q->where('played_at', '>=', $from);
        }
        if ($to) {
            $q->where('played_at', '<=', $to);
        }

        return $q;
    }

    /** DecisionAnalysis -> API ErrorJournalEntry (JSON kolonlari decode edilir). */
    private function entryJson(DecisionAnalysis $d): array
    {
        return [
            'id' => (string) $d->id,
            'matchId' => (string) $d->match_result_id,
            'playedAt' => optional($d->played_at)->toIso8601String(),
            'moveNumber' => $d->move_index,
            'category' => $d->primary_category,
            'tags' => $d->category_tags ?? [],
            'severity' => $d->severity,
            'equityLoss' => (float) $d->equity_loss,
            'playedMove' => $d->played,
            'bestMove' => $d->best,
            'playedEquity' => $d->played_equity !== null ? (float) $d->played_equity : null,
            'bestEquity' => $d->best_equity !== null ? (float) $d->best_equity : null,
            'dice' => $this->diceArr($d->dice),
            'player' => $d->player,
            'myPip' => $d->my_pip,
            'opponentPip' => $d->opp_pip,
            'position' => $this->decode($d->pos),
            'bestSteps' => $this->decode($d->steps) ?? [],
            'playedSteps' => $this->decode($d->played_steps) ?? [],
            'alternatives' => $this->decode($d->cands) ?? [],
        ];
    }

    /** Log JSON'u ayristir. @return array{0:?string,1:array}|null [hc, entries] */
    private function parseLog(?string $raw): ?array
    {
        if (! $raw) {
            return null;
        }
        $data = json_decode($raw, true);
        if (! is_array($data) || ! isset($data['log']) || ! is_array($data['log'])) {
            return null;
        }

        return [$data['hc'] ?? null, $data['log']];
    }

    private function decode(?string $s): ?array
    {
        if ($s === null || $s === '') {
            return null;
        }
        $v = json_decode($s, true);

        return is_array($v) ? $v : null;
    }

    private function diceStr($dice): ?string
    {
        if (! is_array($dice) || count($dice) < 1) {
            return null;
        }
        $a = (int) ($dice[0] ?? 0);
        $b = (int) ($dice[1] ?? $a);

        return "{$a}-{$b}";
    }

    /** "6-3" -> [6,3] */
    private function diceArr(?string $s): ?array
    {
        if (! $s || ! str_contains($s, '-')) {
            return null;
        }
        [$a, $b] = array_pad(explode('-', $s, 2), 2, '0');

        return [(int) $a, (int) $b];
    }

    private function markAnalyzed(MatchResult $mr, int $count): void
    {
        $mr->analyzed_at = Carbon::now();
        $mr->analysis_version = Cfg::ANALYSIS_VERSION;
        $mr->save();
    }
}
