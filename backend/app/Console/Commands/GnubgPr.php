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

        $ml = (int) ($mr->match_length ?? 0); // fallback; mctx varsa karar-başı match-aware kullanılır
        $r = $orch->checkerPr($log, $player, $ml, 2);
        $c = $orch->cubePr($log, $player, $ml);

        // Genel PR = havuzlanmış (checker + cube). PR asla null.
        $totLoss = $r['loss'] + $c['loss'];
        $totDec = $r['decisions'] + $c['decisions'];
        $overall = $totDec > 0 ? ($totLoss / $totDec) * 500 : ($r['pr'] ?: $c['pr']);

        $this->line('');
        $this->line('gnubg CHECKER PR : '.round($r['pr'], 2)
            ."  (sayilan {$r['decisions']}, degerlendirilen {$r['evaluated']}, atlanan {$r['skipped']})");
        $this->line('gnubg CUBE    PR : '.round($c['pr'], 2)
            ."  (sayilan {$c['decisions']}, degerlendirilen {$c['evaluated']}, atlanan {$c['skipped']})");
        $this->line('gnubg GENEL   PR : '.round($overall, 2)."  (toplam sayilan {$totDec})");
        $this->line('client PR (kayit): '.($mr->pr ?? 'null'));

        if ($r['skipped'] > 0) {
            $this->warn('Checker atlama: '.json_encode($r['skipReasons']).'  ilk: '.json_encode($r['firstSkip']));
        }
        foreach (array_slice($r['perDecision'], 0, 6) as $i => $d) {
            $this->line(sprintf('  chk#%-2d %-16s loss=%.4f %s', $i + 1, $d['move'] ?? '?', $d['loss'], $d['counts'] ? '' : '(sayilmaz)'));
        }
        foreach (array_slice($c['perDecision'], 0, 6) as $i => $d) {
            $this->line(sprintf('  cube#%-2d %-10s loss=%.4f %s', $i + 1, $d['chosen'] ?? '?', $d['loss'], $d['counts'] ? '' : '(sayilmaz)'));
        }

        $this->info('Bitti. (gnubg checker+cube; mctx varsa match-aware, yoksa money.)');

        return self::SUCCESS;
    }
}
