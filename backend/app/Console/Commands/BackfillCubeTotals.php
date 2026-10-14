<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Services\Analysis\AnalysisOrchestrator;
use Illuminate\Console\Command;

/**
 * Geçmiş maçlara küp totallerini (cube_equity_lost + cube_decisions) gnubg_review log'undan yaz.
 * KARİYER küp PR'ı bu totallerden hesaplanır (tek maçta küp PR anlamsız; kariyer toplamı anlamlı).
 * Salt review-okuma + 2 kolon yazar (PrFromReview'dan bağımsız). chunkById -> uzak DB'de OOM yok.
 *
 *   php artisan tavla:backfill-cube-totals [--limit=100000]
 */
class BackfillCubeTotals extends Command
{
    protected $signature = 'tavla:backfill-cube-totals {--limit=200000}';

    protected $description = 'Maç başına küp totallerini (cube_equity_lost/cube_decisions) review log\'undan doldurur';

    public function handle(AnalysisOrchestrator $orch): int
    {
        $q = MatchResult::query()->whereNotNull('gnubg_review');
        $this->info('Küp totalleri: '.$q->count().' satır (gnubg_review olan)');
        $done = 0;
        $skipped = 0;
        $q->orderBy('id')->chunkById(150, function ($rows) use ($orch, &$done, &$skipped) {
            foreach ($rows as $r) {
                $review = json_decode((string) $r->gnubg_review, true);
                $log = is_array($review['log'] ?? null) ? $review['log'] : null;
                $hc = $r->analysisHc();
                if (! $log || ! in_array($hc, ['white', 'black'], true)) {
                    $skipped++;

                    continue;
                }
                $self = $orch->prFromReviewLog($log, $hc);
                MatchResult::where('id', $r->id)->update([
                    'cube_equity_lost' => round((float) ($self['cube_equity_lost'] ?? 0), 4),
                    'cube_decisions' => (int) ($self['cube_decisions'] ?? 0),
                ]);
                $done++;
            }
        });
        $this->info("Dolduruldu: $done | atlandı: $skipped");

        return self::SUCCESS;
    }
}
