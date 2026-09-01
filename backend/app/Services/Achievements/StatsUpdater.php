<?php

namespace App\Services\Achievements;

use App\Models\MatchResult;
use App\Models\User;
use App\Models\UserStat;
use App\Support\ErrorJournalConfig as Cfg;

/**
 * StatsUpdater — bir mac sonucundan (MatchResult) INCREMENTAL sayaclari gunceller ve
 * o mac icin event bayraklarini (MatchContext) uretir. Motor calistirmaz; mevcut
 * match_results alanlarini + match_results.log JSON'unu (tarayici WildBG analizi) kullanir.
 *
 * $extra: frontend'in gonderdigi opsiyonel sinyaller (log'da guvenilir olmayanlar):
 *   gammons:int, backgammons:int  -> bu macta mars/katmerli mars galibiyeti sayisi
 *   min_win_prob:float            -> bu macta insanin gordugu en dusuk kazanma % (0..100)
 *   flags:string[]                -> ['prime6','comeback','closeout'] gibi oyun-ici olaylar
 */
final class StatsUpdater
{
    private function thr(string $k, $d = null)
    {
        return AchievementCatalog::threshold($k, $d);
    }

    public function updateForMatch(User $user, MatchResult $mr, array $extra = [], bool $replay = false): MatchContext
    {
        $stat = UserStat::forUser($user->id);
        $ctx = new MatchContext();
        $won = (bool) $mr->won;

        // ---- Seriler (galibiyet/yenilgi) ----
        $lossStreakBefore = (int) $stat->current_loss_streak;
        if ($won) {
            $stat->current_win_streak = (int) $stat->current_win_streak + 1;
            $stat->best_win_streak = max((int) $stat->best_win_streak, (int) $stat->current_win_streak);
            $stat->current_loss_streak = 0;
        } else {
            $stat->current_loss_streak = (int) $stat->current_loss_streak + 1;
            $stat->current_win_streak = 0;
        }

        // ---- Rating zirvesi ----
        $stat->best_rating = max((int) $stat->best_rating, (int) ($user->rating ?? 1500));

        // ---- Zaman-bazli (gece baykusu / gunluk grind) ----
        $when = $mr->created_at ?? now();
        $hour = (int) $when->format('G');
        if ($hour >= (int) $this->thr('night_start', 2) && $hour < (int) $this->thr('night_end', 5)) {
            $stat->night_matches = (int) $stat->night_matches + 1;
        }
        $today = $when->toDateString();
        if (optional($stat->matches_today_date)->toDateString() !== $today) {
            $stat->matches_today = 0;
            $stat->matches_today_date = $today;
        }
        $stat->matches_today = (int) $stat->matches_today + 1;

        // ---- Lifetime coin (ledger yok -> mac sinirlarindaki pozitif farki topla) ----
        $meta = $stat->meta ?? [];
        $bal = (int) ($user->coins ?? 0);
        $lastBal = $meta['last_coin'] ?? null;
        if ($lastBal !== null && $bal > (int) $lastBal) {
            $stat->lifetime_coin = (int) $stat->lifetime_coin + ($bal - (int) $lastBal);
        }
        $meta['last_coin'] = $bal;

        // ---- Mars / katmerli mars (frontend payload — guvenilir kaynak) ----
        $gammons = max(0, (int) ($extra['gammons'] ?? 0));
        $backgammons = max(0, (int) ($extra['backgammons'] ?? 0));
        if ($gammons > 0) {
            $stat->total_gammons = (int) $stat->total_gammons + $gammons;
        }
        if ($backgammons > 0) {
            $stat->total_backgammons = (int) $stat->total_backgammons + $backgammons;
            $ctx->set('flag_backgammon_win');
        }

        // ---- Oyun-ici olay bayraklari (frontend bildirir; yoksa tetiklenmez) ----
        foreach ((array) ($extra['flags'] ?? []) as $f) {
            if ($f === 'prime6') {
                $ctx->set('flag_prime6');
            } elseif ($f === 'comeback') {
                $ctx->set('flag_comeback');
            } elseif ($f === 'closeout') {
                $ctx->set('flag_closeout');
            }
        }

        // ---- Log analizi: zar / yetenek / kup ----
        $skill = $this->analyzeLog($mr->log, $extra);
        if ($skill['analyzed']) {
            $stat->analysis_count = (int) $stat->analysis_count + 1;
            $stat->total_doubles = (int) $stat->total_doubles + $skill['doubles'];
            $stat->correct_cube_decisions = (int) $stat->correct_cube_decisions + $skill['correct_cubes'];
            $stat->best_move_streak = max((int) $stat->best_move_streak, $skill['best_streak']);

            if ($skill['doubles'] >= (int) $this->thr('five_doubles', 5)) {
                $ctx->set('flag_five_doubles');
            }
            if ($skill['saw_66']) {
                $ctx->set('flag_first_66');
            }
            if ($skill['saw_22']) {
                $ctx->set('flag_first_22');
            }
            if ($skill['best_streak'] >= (int) $this->thr('bestmove_streak', 20)) {
                $ctx->set('flag_bestmove20');
            }
            // Hatasiz (blunder'sız) mac
            if ($skill['decisions'] >= (int) $this->thr('clean_min_decisions', 12) && $skill['blunders'] === 0) {
                $stat->clean_matches = (int) $stat->clean_matches + 1;
            }
            // Kup bayraklari
            if ($skill['correct_double']) {
                $ctx->set('flag_correct_double');
            }
            if ($skill['correct_take']) {
                $ctx->set('flag_correct_take');
            }
            if ($skill['hard_take']) {
                $ctx->set('flag_hard_take');
            }
            if ($won && $skill['took_cube']) {
                $ctx->set('flag_take_and_win');
            }
        }

        // ---- PR (hata orani) bazli beceri bayraklari ----
        $pr = $mr->pr !== null ? (float) $mr->pr : null;
        if ($pr !== null) {
            if ($pr <= (float) $this->thr('cerrah_pr', 3.0)) {
                $ctx->set('flag_low_pr');
            }
            if ($pr <= (float) $this->thr('elite_pr', 1.5)) {
                $ctx->set('flag_elite_pr');
            }
            $stat->best_error_rate = $stat->best_error_rate === null
                ? $pr : min((float) $stat->best_error_rate, $pr);
            if ($won && $pr <= (float) $this->thr('perfect_pr', 2.0)
                && (int) ($mr->match_length ?? 0) >= (int) $this->thr('perfect_min_length', 5)) {
                $ctx->set('flag_perfect_game');
            }
        }

        // ---- Sans (luck) bazli bayraklar ----
        $luck = $mr->luck !== null ? (float) $mr->luck : null;
        if ($won && $luck !== null) {
            if ($luck <= (float) $this->thr('low_luck', -6.0)) {
                $ctx->set('flag_win_low_luck');
            }
            if ($luck <= (float) $this->thr('destiny_luck', -14.0)) {
                $ctx->set('flag_destiny');
            }
            if ($luck >= (float) $this->thr('high_luck', 8.0)) {
                $ctx->set('flag_win_high_luck');
            }
        }

        // ---- Kazanma-ihtimali donusu (payload > log fallback) ----
        $minWp = $skill['min_wp'];
        if (isset($extra['min_win_prob']) && is_numeric($extra['min_win_prob'])) {
            $p = (float) $extra['min_win_prob'];
            $minWp = $minWp === null ? $p : min($minWp, $p);
        }
        if ($won && $minWp !== null) {
            if ($minWp <= (float) $this->thr('anka_wp', 2.0)) {
                $ctx->set('flag_anka');
            }
            if ($minWp <= (float) $this->thr('improbable_wp', 5.0)) {
                $ctx->set('flag_improbable');
            }
            if ($minWp <= (float) $this->thr('howcome_wp', 15.0)) {
                $ctx->set('flag_howcome');
            }
        }

        // ---- Rakip / rating bazli ----
        if ($won) {
            $gap = (int) ($mr->opponent_rating ?? 0) - (int) ($mr->rating_before ?? 1500);
            if ($gap >= (int) $this->thr('david_rating_gap', 300)) {
                $ctx->set('flag_david');
            }
            if ($lossStreakBefore >= (int) $this->thr('stubborn_losses', 5)) {
                $ctx->set('flag_stubborn');
            }
            if ($hour >= (int) $this->thr('morning_start', 6) && $hour < (int) $this->thr('morning_end', 8)) {
                $ctx->set('flag_morning_win');
            }
        }

        // ---- Liderlik sirasi (rating) + ilk rutbe yukselisi ----
        // Replay (backfill) modunda agir global/opponent sorgulari atlanir; finalizeFlags() bir kez calisir.
        if ($replay) {
            if ((int) ($mr->delta ?? 0) > 0) {
                $ctx->set('flag_rank_up');
            }
            $stat->meta = $meta;
            $stat->save();
            return $ctx;
        }
        $rank = User::where('rating', '>', (int) ($user->rating ?? 1500))->count() + 1;
        $stat->best_rank = $stat->best_rank === null ? $rank : min((int) $stat->best_rank, $rank);
        if ($rank <= 1000) {
            $ctx->set('flag_top_1000');
        }
        if ($rank <= 100) {
            $ctx->set('flag_top_100');
        }
        if ($rank <= 50) {
            $ctx->set('flag_top_50');
        }
        if ($rank <= 10) {
            $ctx->set('flag_top_10');
        }
        if ($rank <= 1) {
            $ctx->set('flag_top_1');
        }
        if ((int) ($mr->delta ?? 0) > 0) {
            $ctx->set('flag_rank_up');
        }

        // ---- Sosyal (ayni rakip) — sinirli sorgu ----
        if (! empty($mr->opponent_name)) {
            $this->socialFlags($user->id, (string) $mr->opponent_name, $won, $ctx);
        }

        // ---- Tavla Tanrisi: ayni macta yeterince zor sart ----
        $hardFlags = ['flag_anka', 'flag_win_low_luck', 'flag_david', 'flag_perfect_game', 'flag_bestmove20', 'flag_backgammon_win', 'flag_destiny'];
        $hits = count(array_intersect($hardFlags, $ctx->activeFlags()));
        if ($hits >= (int) $this->thr('god_conditions', 3)) {
            $ctx->set('flag_tavla_god');
        }

        $stat->meta = $meta;
        $stat->save();

        return $ctx;
    }

    /**
     * Backfill sonu tek-seferlik bayraklar: liderlik sirasi + nemesis/komsu (nihai duruma gore).
     * Replay dongusunde atlanan agir sorgular burada 1 kez calisir.
     */
    public function finalizeFlags(User $user, MatchContext $ctx): void
    {
        $rank = User::where('rating', '>', (int) ($user->rating ?? 1500))->count() + 1;
        if ($rank <= 1000) { $ctx->set('flag_top_1000'); }
        if ($rank <= 100) { $ctx->set('flag_top_100'); }
        if ($rank <= 50) { $ctx->set('flag_top_50'); }
        if ($rank <= 10) { $ctx->set('flag_top_10'); }
        if ($rank <= 1) { $ctx->set('flag_top_1'); }

        // Ayni rakibe karsi nihai sayimlar: en cok yenilen/karsilasilan.
        $agg = MatchResult::where('user_id', $user->id)
            ->whereNotNull('opponent_name')
            ->selectRaw('opponent_name, count(*) meets, sum(case when won then 1 else 0 end) beats')
            ->groupBy('opponent_name')->get();
        foreach ($agg as $r) {
            if ((int) $r->beats >= (int) $this->thr('nemesis_beats', 10)) { $ctx->set('flag_nemesis'); }
            if ((int) $r->meets >= (int) $this->thr('neighbor_meets', 20)) { $ctx->set('flag_neighbor'); }
        }
    }

    /** Ayni rakiple gecmis: nemesis / komsu / intikam. */
    private function socialFlags(int $userId, string $opp, bool $won, MatchContext $ctx): void
    {
        $rows = MatchResult::where('user_id', $userId)
            ->where('opponent_name', $opp)
            ->selectRaw('count(*) meets, sum(case when won then 1 else 0 end) beats, sum(case when won then 0 else 1 end) losses')
            ->first();
        $meets = (int) ($rows->meets ?? 0);
        $beats = (int) ($rows->beats ?? 0);
        $losses = (int) ($rows->losses ?? 0);

        if ($beats >= (int) $this->thr('nemesis_beats', 10)) {
            $ctx->set('flag_nemesis');
        }
        if ($meets >= (int) $this->thr('neighbor_meets', 20)) {
            $ctx->set('flag_neighbor');
        }
        if ($won && $losses >= (int) $this->thr('revenge_losses', 3)) {
            $ctx->set('flag_revenge');
        }
    }

    /**
     * match_results.log JSON'unu tek geciste ayristir: zar/yetenek/kup sinyalleri.
     * Cube kararlari decision_analyses'e YAZILMADIGI icin burada raw log kullanilir.
     */
    private function analyzeLog(?string $raw, array $extra): array
    {
        $out = [
            'analyzed' => false, 'doubles' => 0, 'saw_66' => false, 'saw_22' => false,
            'decisions' => 0, 'blunders' => 0, 'best_streak' => 0,
            'correct_cubes' => 0, 'correct_double' => false, 'correct_take' => false,
            'hard_take' => false, 'took_cube' => false, 'min_wp' => null,
        ];
        if (! $raw) {
            return $out;
        }
        $data = json_decode($raw, true);
        if (! is_array($data) || ! isset($data['log']) || ! is_array($data['log'])) {
            return $out;
        }
        $hc = $data['hc'] ?? null;
        $eqTol = (float) $this->thr('cube_correct_eqloss', 0.02);
        $hardWp = (float) $this->thr('hard_take_wp', 30.0);

        $out['analyzed'] = true;
        $streak = 0;
        foreach ($data['log'] as $e) {
            if (! is_array($e)) {
                continue;
            }
            $player = $e['player'] ?? null;
            $isHuman = $hc === null ? true : ($player === $hc);
            if (! $isHuman) {
                continue; // yalniz insanin kararlari
            }

            // Kup karari
            if (isset($e['cube']) && is_array($e['cube'])) {
                $cube = $e['cube'];
                $win = isset($cube['win']) ? (float) $cube['win'] : null;
                if ($win !== null) {
                    $out['min_wp'] = $out['min_wp'] === null ? $win : min($out['min_wp'], $win);
                }
                $chosen = strtolower((string) ($cube['chosen'] ?? ''));
                $correct = array_key_exists('correct', $cube)
                    ? (bool) $cube['correct']
                    : (isset($cube['loss']) ? ((float) $cube['loss'] <= $eqTol) : false);
                $isTake = str_contains($chosen, 'take');
                $isDouble = str_contains($chosen, 'double') && ! str_contains($chosen, 'no');
                if ($isTake) {
                    $out['took_cube'] = true;
                }
                if ($correct) {
                    $out['correct_cubes']++;
                    if ($isDouble) {
                        $out['correct_double'] = true;
                    }
                    if ($isTake) {
                        $out['correct_take'] = true;
                        if ($win !== null && $win <= $hardWp) {
                            $out['hard_take'] = true;
                        }
                    }
                }
                continue;
            }

            // Checker karari
            $out['decisions']++;
            $dice = $e['dice'] ?? null;
            if (is_array($dice) && count($dice) >= 2 && (int) $dice[0] === (int) $dice[1]) {
                $out['doubles']++;
                $v = (int) $dice[0];
                if ($v === 6) {
                    $out['saw_66'] = true;
                }
                if ($v === 2) {
                    $out['saw_22'] = true;
                }
            }
            $loss = (float) ($e['loss'] ?? 0);
            if (Cfg::severity($loss) === 'blunder') {
                $out['blunders']++;
            }
            // En iyi hamle: notasyon esit VEYA kayip ~0
            $best = $e['best'] ?? null;
            $played = $e['notation'] ?? null;
            $isBest = ($best !== null && $played !== null && $best === $played) || $loss < 0.005;
            if ($isBest) {
                $streak++;
                $out['best_streak'] = max($out['best_streak'], $streak);
            } else {
                $streak = 0;
            }
        }
        return $out;
    }
}
