<?php

namespace App\Console\Commands;

use App\Models\GameLog;
use Illuminate\Console\Command;

/**
 * Eski maç kayıtlarını (game_logs) budar — özellikle yüksek hacimli pvb (bota karşı)
 * alıştırma maçları tabloyu şişirmesin. Online/yerel maçlar daha uzun tutulabilir.
 *
 * Varsayılan: pvb maçları {--days} günden eskiyse sil. --all ile mod ayrımı yapmadan
 * (online dahil) eski kayıtları da budar. Bitmemiş (status=playing) çok eski kayıtlar da
 * terk edilmiş sayılıp budanır.
 *
 * Kullanım (sunucuda):
 *   php artisan gamelogs:prune --dry-run          # sadece say
 *   php artisan gamelogs:prune                     # pvb, 90 günden eski
 *   php artisan gamelogs:prune --days=30           # pvb, 30 günden eski
 *   php artisan gamelogs:prune --all --days=180    # tüm modlar, 180 günden eski
 */
class PruneGameLogs extends Command
{
    protected $signature = 'gamelogs:prune {--days=90 : Bu günden eski kayıtları budar} {--all : Tüm modlar (yalnız pvb değil)} {--dry-run : Sadece say, silme}';

    protected $description = 'Eski maç kayıtlarını (game_logs) budar (varsayılan: pvb, 90 günden eski)';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);

        $base = function () use ($cutoff) {
            $q = GameLog::where('created_at', '<', $cutoff);
            if (! $this->option('all')) {
                $q->where('mode', 'pvb');
            }

            return $q;
        };

        $count = $base()->count();
        $scope = $this->option('all') ? 'tüm modlar' : 'pvb';
        $this->info("Budanacak ({$scope}, {$days} günden eski) kayıt: {$count}");

        if ($this->option('dry-run')) {
            $this->line('dry-run: hiçbir kayıt silinmedi.');

            return self::SUCCESS;
        }

        if ($count === 0) {
            $this->line('Budanacak kayıt yok.');

            return self::SUCCESS;
        }

        // Büyük tablolarda tek seferde kilitlememek için parça parça sil.
        $deleted = 0;
        do {
            $chunk = $base()->limit(1000)->delete();
            $deleted += $chunk;
        } while ($chunk > 0);

        $this->info("Silindi: {$deleted} maç kaydı.");

        return self::SUCCESS;
    }
}
