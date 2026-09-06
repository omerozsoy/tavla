<?php

namespace App\Console\Commands;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;

/**
 * TEŞHİS: bir .mat DOSYASINI gerçek gnubg'ye besleyip per-oyuncu NATIVE luck'ı gösterir.
 * Varsayılan: bot maçı fixture'ı (tests/Fixtures/bot-match.mat — motorla üretilmiş TAM log).
 * Amaç: BİZİM buildMat çıktımızın gnubg'de İKİ oyuncuya da GERÇEK (0 olmayan) luck verdiğini
 * kanıtlamak -> "biri 0" bug'ının buildMat'ta değil, online kısmi-log'da olduğunu göstermek.
 */
class GnubgMatchLuckFile extends Command
{
    protected $signature = 'tavla:gnubg-matchluck-file {path? : .mat dosya yolu (varsayılan bot fixture)}';

    protected $description = 'Bir .mat dosyasını gerçek gnubg native luck ile analiz eder.';

    public function handle(GnuBgClient $gnubg): int
    {
        $path = $this->argument('path') ?: base_path('tests/Fixtures/bot-match.mat');
        if (! is_file($path)) {
            $this->error("Dosya yok: $path");

            return self::FAILURE;
        }
        $mat = (string) file_get_contents($path);
        $this->line("Dosya: $path (".strlen($mat)." bayt)");
        if (! $gnubg->health()) {
            $this->error('gnubg servisi ERİŞİLEMEZ.');

            return self::FAILURE;
        }

        $r = $gnubg->matchluck($mat);
        if (! is_array($r) || isset($r['exception'], $r['http_status'])) {
            $this->error('matchluck hata: '.json_encode($r));

            return self::FAILURE;
        }
        $this->line('import_cmd: '.($r['import_cmd'] ?? '(başarısız)'));
        if (isset($r['import_err'])) {
            $this->error('import_err: '.$r['import_err']);
        }

        $luck = $r['luck'] ?? null;
        if (! $luck || ! ($luck['p0'] ?? null) || ! ($luck['p1'] ?? null)) {
            $this->error('luck parse edilemedi. Ham istatistik:');
            $this->line((string) ($r['statistics_match'] ?? '(yok)'));

            return self::FAILURE;
        }
        $names = $luck['names'] ?? ['P0(white)', 'P1(black)'];
        $p0 = $luck['p0'];
        $p1 = $luck['p1'];
        $this->line('');
        $this->info(sprintf('%-14s (white): MWC %+.3f%%  EMG %+.4f', $names[0], $p0['mwc_total'] ?? 0, $p0['emg_total'] ?? 0));
        $this->info(sprintf('%-14s (black): MWC %+.3f%%  EMG %+.4f', $names[1], $p1['mwc_total'] ?? 0, $p1['emg_total'] ?? 0));

        // KRİTİK: emg TAM 0 = hesaplanmadı (bug sinyali). İkisi de 0 değilse buildMat+gnubg SAĞLAM.
        $bad = abs((float) ($p0['emg_total'] ?? 0)) < 1e-9 || abs((float) ($p1['emg_total'] ?? 0)) < 1e-9;
        $this->line('');
        if ($bad) {
            $this->error('✗ Bir oyuncunun EMG luck\'ı TAM 0 — bu .mat\'te o oyuncunun hamleleri eksik/hatalı.');

            return self::FAILURE;
        }
        $this->info('✓ İKİ oyuncu da GERÇEK (0 olmayan) luck aldı — buildMat + gnubg SAĞLAM. "Biri 0" bug\'ı online kısmi-log kaynaklı.');

        return self::SUCCESS;
    }
}
