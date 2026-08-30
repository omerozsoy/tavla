<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Services\ErrorJournalService;
use App\Support\ErrorJournalConfig as Cfg;
use Illuminate\Console\Command;

/**
 * Hata Gunlugu backfill: log'u olan eski maclari karar-karar analiz eder
 * (decision_analyses tablosunu doldurur). Production-safe:
 *  - chunkById ile batch (bellek sabit).
 *  - Idempotent: guncel surumle islenmis maclari atlar (--force ile yeniden isler).
 *  - Siniflandirma degisirse ANALYSIS_VERSION artar -> --force ile yeniden uretilir.
 *  - --user=ID: tek kullanici.
 *
 * Kullanim:
 *   php artisan error-journal:backfill
 *   php artisan error-journal:backfill --force
 *   php artisan error-journal:backfill --user=128
 */
class BackfillErrorJournal extends Command
{
    protected $signature = 'error-journal:backfill
        {--force : Guncel surumle islenmis olsa bile yeniden analiz et}
        {--user= : Sadece bu user_id icin calis}';

    protected $description = 'Log iceren maclari Hata Gunlugu icin karar-karar analiz eder (idempotent).';

    public function handle(ErrorJournalService $journal): int
    {
        $userId = $this->option('user') !== null ? (int) $this->option('user') : null;
        $force = (bool) $this->option('force');

        $base = MatchResult::query()->whereNotNull('log');
        if ($userId !== null) {
            $base->where('user_id', $userId);
        }
        $total = (int) $base->count();
        $scope = ($userId !== null ? " [user={$userId}]" : '').($force ? ' (FORCE)' : '');
        $this->info("Hata Gunlugu backfill (v".Cfg::ANALYSIS_VERSION."): {$total} log'lu mac taranacak{$scope}.");

        $processed = 0;
        $analyzed = 0;
        $decisions = 0;

        $base->orderBy('id')->chunkById(500, function ($rows) use ($journal, $force, &$processed, &$analyzed, &$decisions, $total) {
            foreach ($rows as $mr) {
                $n = $journal->analyzeMatch($mr, $force);
                if ($n > 0) {
                    $analyzed++;
                    $decisions += $n;
                }
                $processed++;
            }
            $this->line('Processed '.number_format($processed).' / '.number_format($total).' matches — '
                .number_format($analyzed).' analiz, '.number_format($decisions).' karar.');
        });

        $this->info("Hata Gunlugu backfill tamamlandi: {$analyzed} mac islendi, {$decisions} karar yazildi.");

        return self::SUCCESS;
    }
}
