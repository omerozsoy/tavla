<?php

namespace App\Console\Commands;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;

/**
 * TEŞHİS: gnubg .mat import + analyse + native-luck PARSE hattını doğrular (selftest). gnubg kendi
 * maçını oynar -> export mat -> temiz reimport -> analyse -> per-oyuncu Luck total (MWC%) parse.
 * Bu geçerse üretim /matchluck (backend gerçek .mat gönderir) çalışır. Çıktıyı paylaş.
 */
class GnubgMatchLuckTest extends Command
{
    protected $signature = 'tavla:gnubg-matchluck-test';

    protected $description = 'gnubg .mat import+analyse+luck-parse hattını doğrular (selftest).';

    public function handle(GnuBgClient $gnubg): int
    {
        $this->line('gnubg URL: '.config('gnubg.url'));
        if (! $gnubg->health()) {
            $this->error('gnubg servisi ERİŞİLEMEZ.');

            return self::FAILURE;
        }
        $this->info('Sağlık: OK — selftest (self-play -> export -> reimport -> analyse -> parse)...');

        $r = $gnubg->matchluck(null, true);
        if (! is_array($r) || isset($r['exception']) || isset($r['http_status'])) {
            $this->error('matchluck hata: '.json_encode($r));

            return self::FAILURE;
        }

        $this->line('');
        $this->line('import_cmd: '.($r['import_cmd'] ?? '(başarısız)'));
        if (isset($r['import_err'])) {
            $this->error('import_err: '.$r['import_err'].'  (import mat / load match ikisi de olmadı)');
        }
        if (isset($r['export_err'])) {
            $this->error('export_err: '.$r['export_err']);
        }
        if (isset($r['selftest_mat_head'])) {
            $this->line('');
            $this->line('.mat başı (export):');
            $this->line($r['selftest_mat_head']);
        }

        $luck = $r['luck'] ?? null;
        $this->line('');
        $this->line('== PARSE edilen native luck ==');
        if ($luck && ($luck['p0'] ?? null) && ($luck['p1'] ?? null)) {
            $names = $luck['names'] ?? ['P0', 'P1'];
            $this->info(sprintf('%s: MWC %+.3f%%  (EMG %+.3f, rate %+.3f mEMG)',
                $names[0], $luck['p0']['mwc_total'] ?? 0, $luck['p0']['emg_total'] ?? 0, $luck['p0']['emg_rate'] ?? 0));
            $this->info(sprintf('%s: MWC %+.3f%%  (EMG %+.3f, rate %+.3f mEMG)',
                $names[1], $luck['p1']['mwc_total'] ?? 0, $luck['p1']['emg_total'] ?? 0, $luck['p1']['emg_rate'] ?? 0));
            $this->line('');
            $this->info('HAT ÇALIŞIYOR ✓ — üretim .mat luck hesabı için hazır.');
        } else {
            $this->error('luck PARSE edilemedi. Ham istatistik:');
            $this->line((string) ($r['statistics_match'] ?? '(yok)'));

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
