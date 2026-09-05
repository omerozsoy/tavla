<?php

namespace App\Console\Commands;

use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;

/**
 * Iki bot (gnubg) bir oyun oynar (beyaz bazen kasitli hata yapar), sonra beyazin PR'ini
 * gnubg orkestratoruyle hesaplar. Orchestrator'i GERCEK, dolu bir macta uctan uca dogrular.
 * Tarayici gerekmez. Laravel Toolkit'ten calistir.
 */
class GnubgSelfplay extends Command
{
    protected $signature = 'tavla:gnubg-selfplay {--error=0.35 : beyazin hata olasiligi} {--plies=1 : uretim ply}';

    protected $description = 'Iki bot bir oyun oynar, sonra beyazin PR ini gnubg ile hesaplar (pipeline testi).';

    public function handle(GnuBgClient $gnubg, AnalysisOrchestrator $orch): int
    {
        $err = (float) $this->option('error');
        $this->line('Iki bot oynuyor (gnubg self-play)...');
        $sp = $gnubg->selfplay(['white_error' => $err, 'plies' => (int) $this->option('plies')]);
        if ($sp === null || empty($sp['log'])) {
            $this->error('Self-play basarisiz (servis/secret? gnubg calisiyor mu?).');

            return self::FAILURE;
        }
        $this->line("Oyun bitti: kazanan={$sp['winner']}  toplam-karar={$sp['decisions']}");
        if (! empty($sp['invalid'])) {
            $this->error('TAHTA BOZULDU (self-play bug): '.json_encode($sp['invalid']));
        }
        if (empty($sp['winner']) && ! empty($sp['stuck'])) {
            $this->warn('TAKILDI (kazanan yok): '.json_encode($sp['stuck']));
        }

        $r = $orch->checkerPr($sp['log'], 'white', 0, 2); // beyazi 2-ply ile yeniden degerlendir

        $this->line('');
        $this->line('BEYAZ gnubg checker PR : '.round($r['pr'], 2)
            ."  (sayilan {$r['decisions']}, degerlendirilen {$r['evaluated']}, atlanan {$r['skipped']})");
        $this->line('  strict='.($r['strictPr'] !== null ? round($r['strictPr'], 2) : '-')
            .'  loose='.($r['loosePr'] !== null ? round($r['loosePr'], 2) : '-'));

        if ($r['skipped'] > 0) {
            $this->warn('Atlama sebepleri: '.json_encode($r['skipReasons']));
            $this->warn('Ilk atlanan: '.json_encode($r['firstSkip']));
        }
        foreach (array_slice($r['perDecision'], 0, 10) as $i => $d) {
            $this->line(sprintf('  #%-2d %-16s loss=%.4f %s', $i + 1, $d['move'] ?? '?', $d['loss'], $d['counts'] ? '' : '(sayilmaz)'));
        }

        $this->info('Bitti. Beyaz ~'.(int) ($err * 100).'% hata yapti -> PR sifirdan buyuk olmali.');

        return self::SUCCESS;
    }
}
