<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Services\Analysis\AnalysisOrchestrator;
use Illuminate\Console\Command;

/**
 * PR'ı gnubg_review (reviewMatch, tam .mat = SUNUCU match_moves) LOG'undan YENİDEN türetip match_results'ı
 * düzeltir. Buggy per-pozisyon cubePr yüzünden YANLIŞ yazılmış küp/genel PR'ları onarır (EU6CD: kusursuz
 * oyuncuya 18.54 PR -> gerçek ~1). Yalnız gnubg_review'i OLAN satırlar işlenir (review = tek doğru kaynak).
 *
 * Kullanım: php artisan tavla:pr-from-review [--room=CODE] [--id=N] [--since=2026-10-01] [--apply]
 *   --apply YOKSA dry-run (yalnız farkları listeler, YAZMAZ).
 */
class PrFromReview extends Command
{
    protected $signature = 'tavla:pr-from-review {--room=} {--id=} {--since=} {--limit=100000} {--apply}';

    protected $description = 'PR/küp PR\'ı gnubg_review\'dan yeniden türetip düzeltir (buggy cubePr onarımı)';

    public function handle(AnalysisOrchestrator $orch): int
    {
        $apply = (bool) $this->option('apply');
        $q = MatchResult::query()
            ->whereNotNull('gnubg_review')
            ->whereNotNull('room_code');
        if ($this->option('room')) {
            $q->where('room_code', strtoupper((string) $this->option('room')));
        }
        if ($this->option('id')) {
            $q->where('id', (int) $this->option('id'));
        }
        if ($this->option('since')) {
            $q->where('created_at', '>=', (string) $this->option('since'));
        }
        $rows = $q->orderByDesc('id')->limit((int) $this->option('limit'))->get();

        $this->info(($apply ? 'UYGULA' : 'DRY-RUN').': '.$rows->count().' satır (gnubg_review olan)');
        $fixed = 0;
        $skipped = 0;
        foreach ($rows as $r) {
            $review = json_decode((string) $r->gnubg_review, true);
            $log = is_array($review['log'] ?? null) ? $review['log'] : null;
            $hc = $r->analysisHc();
            if (! $log || ! in_array($hc, ['white', 'black'], true)) {
                $skipped++;

                continue;
            }
            $self = $orch->prFromReviewLog($log, $hc);
            $opp = $orch->prFromReviewLog($log, $hc === 'white' ? 'black' : 'white');

            $newPr = round($self['pr'], 2);
            $oldPr = $r->gnubg_pr !== null ? round((float) $r->gnubg_pr, 2) : null;
            $diff = $oldPr === null || abs($newPr - $oldPr) > 0.01;
            if (! $diff) {
                $skipped++;

                continue;
            }
            $this->line(sprintf('#%d %s: PR %s -> %.2f | cube %s -> %s',
                $r->id, $r->room_code, $oldPr === null ? '—' : number_format($oldPr, 2), $newPr,
                $r->gnubg_cube_pr === null ? '—' : number_format((float) $r->gnubg_cube_pr, 2),
                $self['cube_pr'] === null ? '—' : number_format($self['cube_pr'], 2)));

            if ($apply) {
                MatchResult::where('id', $r->id)->update([
                    'gnubg_pr' => $newPr,
                    'gnubg_checker_pr' => $self['checker_pr'] !== null ? round($self['checker_pr'], 2) : null,
                    'gnubg_cube_pr' => $self['cube_pr'] !== null ? round($self['cube_pr'], 2) : null,
                    'pr_equity_lost' => round($self['equity_lost'], 4),
                    'pr_decisions' => $self['decisions'],
                    'pr' => $newPr, // gösterilen (eski istemci pr yerine yetkili review PR)
                    'gnubg_opponent_pr' => round($opp['pr'], 2),
                    'gnubg_opponent_checker_pr' => $opp['checker_pr'] !== null ? round($opp['checker_pr'], 2) : null,
                    'gnubg_opponent_cube_pr' => $opp['cube_pr'] !== null ? round($opp['cube_pr'], 2) : null,
                ]);
                // Rakip satırı (varsa) da aynı review'dan: onun opponent_pr'ı = benim self PR'ım.
                MatchResult::where('room_code', $r->room_code)->where('user_id', '!=', $r->user_id)
                    ->update(['opponent_pr' => $newPr]);
            }
            $fixed++;
        }
        $this->info(($apply ? 'Düzeltildi' : 'Düzeltilecek').": $fixed | atlandı: $skipped");

        return self::SUCCESS;
    }
}
