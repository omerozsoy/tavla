<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TEMIZ BASLANGIC — tum mac verisini + turetilmis istatistikleri siler, puanlari 1400'e
 * sifirlar. GNU-only PR mimarisine gecerken eski (wildbg + eski XG-heuristik) PR'lar gecersiz
 * oldugu icin sifirdan basliyoruz.
 *
 * SILINIR: match_results, game_logs, decision_analyses, blunders, user_wxp_transactions,
 *          user_stats, user_achievements, rooms.
 * SIFIRLANIR (users): rating=1400, wins=0, losses=0, games_played=0, total_wxp=0.
 * KORUNUR: hesaplar (users satirlari), coins (jetonlar), payments, tournaments, contents,
 *          messages, friendships, clubs, menu, reklamlar.
 *
 * GERI ALINAMAZ. Once DB yedegi al (Plesk > Veritabanlari > Disa Aktar veya mysqldump).
 */
class ResetMatches extends Command
{
    protected $signature = 'tavla:reset-matches {--force : Onay sormadan calistir}';

    protected $description = 'TUM mac verisi + turetilmis istatistikleri siler, puanlari 1400e sifirlar (temiz baslangic). Hesaplar/jetonlar/odemeler KORUNUR.';

    /** Tamamen bosaltilacak tablolar (cocuk -> ebeveyn sirasi; FK zaten kapatiliyor). */
    private array $wipe = [
        'decision_analyses',
        'blunders',
        'game_logs',
        'match_results',
        'user_wxp_transactions',
        'user_stats',
        'user_achievements',
        'rooms',
    ];

    public function handle(): int
    {
        $this->warn('GERI ALINAMAZ. Bosaltilacak: '.implode(', ', $this->wipe));
        $this->line('Korunacak: users, coins, payments, tournaments, contents, messages, friendships.');
        if (! $this->option('force') && ! $this->confirm('Devam edilsin mi?')) {
            $this->info('Iptal edildi.');

            return self::SUCCESS;
        }

        Schema::disableForeignKeyConstraints();
        try {
            foreach ($this->wipe as $t) {
                if (! Schema::hasTable($t)) {
                    $this->line(sprintf('  %-24s (tablo yok, atlandi)', $t));

                    continue;
                }
                $n = DB::table($t)->count();
                DB::table($t)->truncate();
                $this->line(sprintf('  %-24s bosaltildi (%d satir)', $t, $n));
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        // users: hesabi KORU, yalniz turetilmis alanlari sifirla.
        $reset = [];
        foreach (['rating' => 1400, 'wins' => 0, 'losses' => 0, 'games_played' => 0, 'total_wxp' => 0] as $col => $val) {
            if (Schema::hasColumn('users', $col)) {
                $reset[$col] = $val;
            }
        }
        if ($reset !== []) {
            $count = DB::table('users')->update($reset);
            $this->line('  users sifirlandi ('.$count.' kullanici): '.json_encode($reset));
        }

        $this->info('Bitti. Temiz baslangic hazir.');

        return self::SUCCESS;
    }
}
