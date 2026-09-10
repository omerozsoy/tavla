<?php

namespace App\Console\Commands;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A→Z gnubg icin OPERASYON DENETIMI: gnubg servisi + PR modu + queue worker + son analiz.
 * Sunucuda `php artisan tavla:gnubg-status` ile calistir. Salt-okunur.
 */
class GnubgStatus extends Command
{
    protected $signature = 'tavla:gnubg-status';

    protected $description = 'gnubg servisi + PR modu + queue worker + son gnubg analizi durumunu ozetler.';

    public function handle(GnuBgClient $gnubg): int
    {
        $ok = fn (bool $b) => $b ? '<info>OK</info>' : '<error>HAYIR</error>';

        $url = (string) config('gnubg.url', '');
        $secretSet = (string) config('gnubg.secret', '') !== '';
        $prMode = (string) config('gnubg.pr_mode', 'off');

        $this->line('');
        $this->line('=== gnubg OPERASYON DURUMU ===');
        $this->line('GNUBG_URL        : '.($url ?: '<error>BOS</error>'));
        $this->line('GNUBG_SECRET     : '.$ok($secretSet).($secretSet ? '' : '  (bos -> servis 401 verebilir)'));
        $this->line('GNUBG_PR_MODE    : '.$prMode.match ($prMode) {
            'authoritative' => '  <info>(gosterilen PR = gnubg)</info>',
            'shadow' => '  (yalniz gnubg_* shadow; gosterilen PR hala istemci)',
            default => '  <error>(KAPALI -> gnubg PR hesaplanmaz)</error>',
        });

        // 1) gnubg servis /health
        $this->line('');
        $health = false;
        try {
            $health = $gnubg->health();
        } catch (\Throwable $e) {
            $this->line('gnubg /health   : <error>ISTISNA</error> '.$e->getMessage());
        }
        $this->line('gnubg /health    : '.$ok($health).($health ? '' : '  (servis kapali/erisilemez -> job sessiz gecer, istemci PR kalir)'));

        // 2) Queue (AnalyzeMatchPrJob buraya duser)
        $this->line('');
        $this->line('QUEUE_CONNECTION : '.config('queue.default'));
        try {
            $pending = (int) DB::table('jobs')->count();
            $oldest = $pending > 0 ? (time() - (int) DB::table('jobs')->min('available_at')) : 0;
            $failed = Schema::hasTable('failed_jobs') ? (int) DB::table('failed_jobs')->count() : 0;
            $workerHint = $pending === 0 ? 'bosta (bekleyen yok)' : ($oldest < 90 ? 'taze is akiyor -> worker CALISIYOR' : 'birikmis ('.$oldest.'sn) -> worker KAPALI OLABILIR');
            $this->line('bekleyen is      : '.$pending.'   en eski: '.$oldest.'sn   -> '.$workerHint);
            $this->line('basarisiz is     : '.$failed.($failed > 0 ? '  <error>(queue:failed ile incele)</error>' : ''));
        } catch (\Throwable $e) {
            $this->line('jobs tablosu     : <error>okunamadi</error> '.$e->getMessage());
        }

        // 3) Son gnubg analizi gercekten yaziliyor mu?
        $this->line('');
        if (Schema::hasColumn('match_results', 'gnubg_pr')) {
            $withGnubg = (int) DB::table('match_results')->whereNotNull('gnubg_pr')->count();
            $last = DB::table('match_results')->whereNotNull('gnubg_pr')
                ->orderByDesc('id')->first(['id', 'pr', 'gnubg_pr', 'gnubg_pr_at']);
            $this->line('gnubg_pr dolu mac: '.$withGnubg);
            if ($last) {
                $this->line('son analiz       : #'.$last->id.'  pr(gosterilen)='.$last->pr.'  gnubg_pr='.$last->gnubg_pr.'  at='.($last->gnubg_pr_at ?? '?'));
                if ($prMode === 'authoritative' && $last->pr !== null && abs((float) $last->pr - (float) $last->gnubg_pr) > 0.01) {
                    $this->warn('  NOT: authoritative ama pr != gnubg_pr — bu satir mod acilmadan ONCE yazilmis olabilir (yeni maclarda esitlenecek).');
                }
            }
        } else {
            $this->line('gnubg_pr kolonu  : <error>YOK</error> (migrate gerekli)');
        }

        // Ozet
        $this->line('');
        $ready = $url && $health && $prMode === 'authoritative';
        $this->line($ready
            ? '<info>HAZIR: yeni maclarda gnubg otoriter PR yazacak (worker calisiyorsa).</info>'
            : '<comment>EKSIK: yukaridaki HAYIR/KAPALI satirlarini gider (env + servis + worker) sonra config:clear + FPM restart.</comment>');

        return self::SUCCESS;
    }
}
