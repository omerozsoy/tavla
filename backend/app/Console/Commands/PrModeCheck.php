<?php

namespace App\Console\Commands;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;

/**
 * GÖSTERİLEN PR'ın kaynağını teşhis eder: GNUBG_PR_MODE + gnubg servisi erişilebilir mi.
 *
 *  off           -> gösterilen PR = client (wildbg, tarayıcı). gnubg HİÇ çalışmaz.
 *  shadow        -> gnubg arka planda hesaplar + loglar AMA gösterilen PR yine client (wildbg).
 *  authoritative -> gösterilen PR = gnubg (match-aware, XG'ye yakın). ASIL istenen bu.
 *
 * XG paritesi için: GNUBG_PR_MODE=authoritative + gnubg servisi UP olmalı. Değiştirmek için
 * sunucu .env'ine `GNUBG_PR_MODE=authoritative` yazıp PHP-FPM restart (config env-driven).
 */
class PrModeCheck extends Command
{
    protected $signature = 'tavla:pr-mode';

    protected $description = 'Gösterilen PR kaynağını teşhis eder (GNUBG_PR_MODE + gnubg servisi durumu).';

    public function handle(GnuBgClient $gnubg): int
    {
        $mode = (string) config('gnubg.pr_mode', 'off');
        $url = (string) config('gnubg.url');
        $hasSecret = config('gnubg.secret') !== '';

        $this->line('GNUBG_PR_MODE : '.$mode);
        $this->line('GNUBG_URL     : '.$url);
        $this->line('GNUBG_SECRET  : '.($hasSecret ? 'set' : 'BOŞ (servis 401 verebilir)'));

        $up = false;
        try {
            $up = $gnubg->health();
        } catch (\Throwable $e) {
            $this->warn('health() hata: '.$e->getMessage());
        }
        $this->line('gnubg servisi : '.($up ? 'UP' : 'ERİŞİLEMİYOR'));

        $this->line('');
        if ($mode === 'authoritative' && $up) {
            $this->info('✓ Gösterilen PR = gnubg (match-aware, XG\'ye yakın). Doğru yapılandırma.');
        } elseif ($mode === 'authoritative' && ! $up) {
            $this->error('✗ pr_mode=authoritative ama gnubg ERİŞİLEMİYOR -> PR client (wildbg) fallback\'e düşer. gnubg-service\'i başlat.');
        } elseif ($mode === 'shadow') {
            $this->warn('⚠ shadow: gnubg hesaplıyor ama GÖSTERİLEN PR hâlâ client (wildbg). XG paritesi için authoritative yap.');
        } else {
            $this->warn('⚠ off: gösterilen PR = client (wildbg); gnubg HİÇ çalışmaz. XG paritesi için authoritative yap.');
        }
        $this->line('Değiştir: sunucu .env -> GNUBG_PR_MODE=authoritative ; sonra PHP-FPM restart.');

        return self::SUCCESS;
    }
}
