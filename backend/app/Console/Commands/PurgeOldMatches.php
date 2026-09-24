<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Belirtilen günden (varsayılan 7) ESKİ maç verilerini siler; SON 1 hafta korunur.
 * Kapsam: match_results (+ FK ile decision_analyses cascade) + blunders + game_logs + eski
 * BİTMİŞ odalar. Tarih ölçütü her tabloda created_at < (şimdi - gün).
 *
 * GÜVENLİK: varsayılan DRY-RUN (yalnız sayar, SİLMEZ). Gerçekten silmek için --force.
 * GERİ ALINAMAZ -> önce DB yedeği al (Plesk > Veritabanları > Dışa Aktar).
 *
 * Kullanım:
 *   php artisan tavla:purge-old-matches            # kaç kayıt silinecek (dry-run)
 *   php artisan tavla:purge-old-matches --force    # gerçekten sil (son 7 gün kalır)
 *   php artisan tavla:purge-old-matches --days=14 --force
 *   php artisan tavla:purge-old-matches --keep-rooms --force   # odaları koru
 */
class PurgeOldMatches extends Command
{
    protected $signature = 'tavla:purge-old-matches
        {--days=7 : Bu kadar GÜNDEN eski maçlar silinir (son bu kadar gün korunur)}
        {--keep-rooms : Eski bitmiş odaları SİLME}
        {--force : Dry-run olmadan GERÇEKTEN sil (GERİ ALINAMAZ)}';

    protected $description = 'N günden (vars. 7) eski maçları ve ilişkili analiz kayıtlarını siler; son 1 hafta kalır.';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);
        $force = (bool) $this->option('force');

        // [tablo, tarih kolonu, ekstra WHERE (opsiyonel)]
        $targets = [
            ['match_results', 'created_at', null],
            ['decision_analyses', 'created_at', null], // match FK cascade + doğrudan da temizle
            ['blunders', 'created_at', null],
            ['game_logs', 'created_at', null],
        ];
        if (! $this->option('keep-rooms')) {
            // Yalnız BİTMİŞ eski odalar (aktif/oynanan odaya asla dokunma).
            $targets[] = ['rooms', 'created_at', ['status', '=', 'finished']];
        }

        $this->line('Kesim tarihi: '.$cutoff->format('d.m.Y H:i').' (bundan ESKİ kayıtlar).');
        $this->newLine();

        $rows = [];
        $grand = 0;
        foreach ($targets as [$table, $col, $extra]) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $col)) {
                $rows[] = [$table, 'tablo/kolon yok', '-'];

                continue;
            }
            $q = DB::table($table)->where($col, '<', $cutoff);
            if ($extra) {
                $q->where($extra[0], $extra[1], $extra[2]);
            }
            $count = (clone $q)->count();
            $grand += $count;
            $rows[] = [$table, number_format($count, 0, ',', '.'), $extra ? $extra[0].' '.$extra[1].' '.$extra[2] : '—'];
        }

        $this->table(['Tablo', 'Silinecek', 'Koşul'], $rows);

        if ($grand === 0) {
            $this->info('Silinecek eski kayıt yok.');

            return self::SUCCESS;
        }

        if (! $force) {
            $this->warn("DRY-RUN: toplam {$grand} kayıt silinebilir. Gerçekten silmek için --force ekle.");
            $this->line('Önce DB yedeği al (GERİ ALINAMAZ).');

            return self::SUCCESS;
        }

        $this->warn('GERİ ALINAMAZ silme başlıyor…');
        $deleted = 0;
        foreach ($targets as [$table, $col, $extra]) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $col)) {
                continue;
            }
            $q = DB::table($table)->where($col, '<', $cutoff);
            if ($extra) {
                $q->where($extra[0], $extra[1], $extra[2]);
            }
            $n = $q->delete();
            $deleted += $n;
            $this->line("  {$table}: {$n} silindi.");
        }

        $this->info("Bitti. Toplam {$deleted} kayıt silindi. Son {$days} gün korundu.");

        return self::SUCCESS;
    }
}
