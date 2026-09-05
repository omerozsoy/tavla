<?php

namespace App\Console\Commands;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;

/**
 * Backend -> gnubg servisi baglantisini uctan uca test eder: acilis 3-1 -> en iyi 8/5 6/5.
 * gnubg-service /maptest ile ayni beklenti, ama PHP GnuBgClient uzerinden (env/secret dogrulamasi).
 */
class GnubgTest extends Command
{
    protected $signature = 'tavla:gnubg-test';

    protected $description = 'gnubg servisi baglantisini test eder (acilis 3-1 -> 8/5 6/5 beklenir).';

    public function handle(GnuBgClient $gnubg): int
    {
        $this->line('gnubg URL: '.config('gnubg.url'));
        if (! $gnubg->health()) {
            $this->error('gnubg servisi ERISILEMEZ. GNUBG_URL dogru mu + servis calisiyor mu?');

            return self::FAILURE;
        }
        $this->info('Saglik: OK');

        // Acilis tahtasi (beyaz +, siyah -), beyaz on-roll, zar 3-1.
        $opening = [-2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2];
        $res = $gnubg->analyze([
            'points' => $opening,
            'turn' => 'white',
            'dice' => [3, 1],
            'matchLength' => 5,
            'plies' => 2,
        ]);
        if ($res === null) {
            $this->error('analyze basarisiz (secret yanlis olabilir veya servis hata verdi). Log kontrol.');

            return self::FAILURE;
        }

        $cand = $res['result']['hint'] ?? [];
        $best = $cand[0]['move'] ?? null;
        $this->line('En iyi: '.json_encode($best));
        foreach (array_slice($cand, 0, 3) as $c) {
            $this->line(sprintf('  %-16s eq=%+.4f  eqdiff=%+.4f', $c['move'] ?? '?', $c['equity'] ?? 0, $c['eqdiff'] ?? 0));
        }

        if ($best === '8/5 6/5') {
            $this->info('BASARILI: backend -> gnubg dogru analiz veriyor.');

            return self::SUCCESS;
        }
        $this->warn('Beklenen "8/5 6/5" degil. Yonelim/secret kontrol et.');

        return self::FAILURE;
    }
}
