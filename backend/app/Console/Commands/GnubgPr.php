<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Services\Analysis\AnalysisOrchestrator;
use Illuminate\Console\Command;

/**
 * Bir macin logunu gnubg orkestratoruyle analiz edip checker PR uretir; kayitli client PR ile
 * karsilastirir (shadow dogrulama). Laravel Toolkit'ten calistir. id bos -> log'u dolu son mac.
 */
class GnubgPr extends Command
{
    protected $signature = 'tavla:gnubg-pr {id? : match_results id (bos = log dolu son mac)}';

    protected $description = 'Bir macin logunu gnubg ile analiz eder, checker PR uretir (client PR ile karsilastirir).';

    public function handle(AnalysisOrchestrator $orch): int
    {
        $mr = $this->argument('id')
            ? MatchResult::find($this->argument('id'))
            : MatchResult::whereNotNull('log')->latest('id')->first();

        if (! $mr) {
            $this->error('Mac bulunamadi (log dolu bir match_results yok). Once bir mac oyna.');

            return self::FAILURE;
        }
        if (empty($mr->log)) {
            $this->error("Mac #{$mr->id} log alani bos.");

            return self::FAILURE;
        }

        $decoded = json_decode($mr->log, true);
        if (! is_array($decoded) || empty($decoded['log'])) {
            $this->error('Log parse edilemedi veya bos.');

            return self::FAILURE;
        }
        $player = $decoded['hc'] ?? 'white';
        $log = $decoded['log'];

        $this->line("Mac #{$mr->id}  oyuncu=$player  match_length=".($mr->match_length ?? 0).'  log-entry='.count($log));
        $this->line('Analiz ediliyor (gnubg, karar basina bir cagri)...');

        $r = $orch->checkerPr($log, $player, 0, 2); // v1: money temeli

        $this->line('');
        $this->line('gnubg checker PR : '.round($r['pr'], 2)
            ."  (sayilan {$r['decisions']}, degerlendirilen {$r['evaluated']}, atlanan {$r['skipped']})");
        $this->line('  strict='.($r['strictPr'] !== null ? round($r['strictPr'], 2) : '-')
            .'  loose='.($r['loosePr'] !== null ? round($r['loosePr'], 2) : '-'));
        $this->line('client PR (kayit): '.($mr->pr ?? 'null'));

        // Atlama teshisi: neden atlandi + ilk atlanan girdinin yapisi.
        if ($r['skipped'] > 0) {
            $this->warn('Atlama sebepleri: '.json_encode($r['skipReasons']));
            $this->warn('Ilk atlanan: '.json_encode($r['firstSkip']));
        }

        foreach (array_slice($r['perDecision'], 0, 8) as $i => $d) {
            $this->line(sprintf('  #%-2d %-16s loss=%.4f %s', $i + 1, $d['move'] ?? '?', $d['loss'], $d['counts'] ? '' : '(sayilmaz)'));
        }

        $this->info('Bitti. (gnubg = checker-only + money v1; client = checker+cube.)');

        return self::SUCCESS;
    }
}
