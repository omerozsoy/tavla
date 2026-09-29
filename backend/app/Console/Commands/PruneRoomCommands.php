<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * room_commands BUDAMA: BİTMİŞ + N günden eski odaların otoriter komut fişlerini siler.
 *
 * room_commands YALNIZ canlı oyunda idempotency (command_id dedup) + versiyon sırası için
 * gerekir; maç bitince ölü ağırlıktır (211k satıra kadar şişip DB sıcak setini büyütmüştü).
 * ANALİZİ ETKİLEMEZ: PR/.mat/luck/review 'match_moves' + 'match_results'tan okunur; bu tabloda
 * hamle/tahta verisi YOKTUR. Aktif (status<>finished) oda komutlarına DOKUNMAZ. Partiler halinde
 * siler -> canlı yazımı uzun kilit/deadlock ile bloklamaz.
 *
 *   php artisan tavla:prune-room-commands --dry-run   # sadece say
 *   php artisan tavla:prune-room-commands             # sil (varsayilan 2 gun)
 *   php artisan tavla:prune-room-commands --days=7
 */
class PruneRoomCommands extends Command
{
    protected $signature = 'tavla:prune-room-commands
        {--days=2 : Bu kadar günden eski BİTMİŞ odaların komutları silinir}
        {--batch=5000 : Parti başına silinecek satır}
        {--dry-run : Sadece say, silme}';

    protected $description = 'Bitmiş+eski odaların room_commands satırlarını partiler halinde budar (idempotency defteri; analizi etkilemez).';

    public function handle(): int
    {
        if (! Schema::hasTable('room_commands')) {
            $this->warn('room_commands tablosu yok — atlandı.');

            return self::SUCCESS;
        }
        $days = max(0, (int) $this->option('days'));
        $batch = max(100, (int) $this->option('batch'));
        $cut = now()->subDays($days);

        // Hedef: room_id, BİTMİŞ + eski bir odaya ait olan komutlar. Aktif odalar dışlanır.
        $target = fn () => DB::table('room_commands')->whereIn(
            'room_id',
            DB::table('rooms')->where('status', 'finished')->where('updated_at', '<', $cut)->select('id'),
        );

        if ($this->option('dry-run')) {
            $this->info('Silinecek: '.$target()->count().' satır (bitmiş + '.$days.' günden eski oda).');

            return self::SUCCESS;
        }

        $total = 0;
        do {
            $n = $target()->limit($batch)->delete();
            $total += $n;
            if ($n > 0) {
                usleep(100_000); // canlıya nazik: partiler arası 0.1sn
            }
        } while ($n > 0);

        $this->info("room_commands budandı: {$total} satır silindi (>{$days} gün, bitmiş odalar).");

        return self::SUCCESS;
    }
}
