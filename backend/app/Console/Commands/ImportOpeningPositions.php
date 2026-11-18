<?php

namespace App\Console\Commands;

use App\Models\OpeningPosition;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Açılış pratiği havuzunu database/data/opening_positions.csv.gz dosyasından doldurur.
 * Idempotent: tabloyu boşaltıp yeniden yazar (dosya otoritedir). Chunk'lı insert -> uzak DB'de OOM yok.
 * Dosya export'u: positions-collection/collector/export_openings_db.py (board+zar başına tek temsilci).
 *
 *   php artisan openings:import
 */
class ImportOpeningPositions extends Command
{
    protected $signature = 'openings:import';

    protected $description = 'Açılış pratiği pozisyonlarını CSV.gz dosyasından opening_positions tablosuna yükler';

    public function handle(): int
    {
        $path = database_path('data/opening_positions.csv.gz');
        if (! is_file($path)) {
            $this->error("Dosya yok: $path");

            return self::FAILURE;
        }

        $fh = gzopen($path, 'rb');
        if (! $fh) {
            $this->error('gzopen başarısız');

            return self::FAILURE;
        }

        DB::table('opening_positions')->truncate();
        gzgets($fh); // başlık satırını atla

        $batch = [];
        $total = 0;
        // insertOrIgnore: kaynak CSV'de aynı xgid tekrar ederse (dedupe kaçağı) unique kısıt
        // ilk kaydı tutar, tekrarı sessizce atlar -> deploy migrate'i duplicate-key ile patlamaz.
        $insert = function (array $rows) {
            DB::table('opening_positions')->insertOrIgnore($rows);
        };
        while (($line = gzgets($fh)) !== false) {
            $line = rtrim($line, "\r\n");
            if ($line === '') {
                continue;
            }
            [$dice, $band, $xgid, $answer] = array_pad(str_getcsv($line), 4, '');
            if ($xgid === '') {
                continue;
            }
            $batch[] = ['dice' => $dice, 'band' => $band, 'xgid' => $xgid, 'answer' => $answer];
            if (count($batch) >= 1000) {
                $insert($batch);
                $total += count($batch);
                $batch = [];
            }
        }
        if ($batch) {
            $insert($batch);
            $total += count($batch);
        }
        gzclose($fh);

        $this->info("Yüklendi: $total pozisyon (".OpeningPosition::count().' tabloda)');

        return self::SUCCESS;
    }
}
