<?php

namespace App\Console\Commands;

use App\Jobs\AnalyzeMatchPrJob;
use App\Models\MatchResult;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TEK MAÇ PR TEŞHİSİ ("neden — kaldı?"). Sonuç ekranında PR "—" görünen bir maç için
 * BÜTÜN zinciri (kayıtlı kolonlar + pr_mode + gnubg sağlığı + queue worker + failed_jobs)
 * kontrol edip DÜZ TÜRKÇE bir hüküm + tam düzeltme komutu basar. Salt-okunur; --redispatch
 * ile o maçın PR analizini yeniden kuyruğa alır.
 *
 * Kullanım (SUNUCUDA):
 *   php artisan tavla:pr-why 4D5Z7            # teşhis
 *   php artisan tavla:pr-why 4D5Z7 --redispatch   # teşhis + yeniden analiz kuyruğa al
 */
class PrWhy extends Command
{
    protected $signature = 'tavla:pr-why {code : Maç kodu (sonuç ekranındaki "Maç Kodu")} {--redispatch : PR analizini bu maç için yeniden kuyruğa al}';

    protected $description = 'Bir maçın PR neden "—" kaldığını uçtan uca teşhis eder (kolonlar + gnubg + worker + failed_jobs) ve hüküm verir.';

    public function handle(GnuBgClient $gnubg): int
    {
        $code = trim((string) $this->argument('code'));
        $ok = fn (bool $b) => $b ? '<info>OK</info>' : '<error>HAYIR</error>';

        if (! Schema::hasColumn('match_results', 'room_code')) {
            $this->error('match_results.room_code kolonu yok -> maç kodu ile sorgulanamaz (migrate gerekli).');

            return self::FAILURE;
        }

        $rows = MatchResult::where('room_code', $code)->orderBy('id')->get();
        $this->line('');
        $this->line("=== PR TEŞHİSİ — maç kodu {$code} ===");
        if ($rows->isEmpty()) {
            $this->error('Bu koda ait match_results satırı YOK. Kod yanlış olabilir ya da maç kaydı hiç oluşmadı (reportRating çağrılmadı).');

            return self::FAILURE;
        }

        // 1) Kayıtlı kolonlar (her oyuncu satırı)
        $has = fn (string $c) => Schema::hasColumn('match_results', $c);
        foreach ($rows as $mr) {
            $logLen = $mr->log ? strlen((string) $mr->log) : 0;
            $this->line('');
            $this->line("--- satır #{$mr->id}  (user_id={$mr->user_id})  ---");
            $this->line('  match_type      : '.($mr->match_type ?? '?').'   match_length='.($mr->match_length ?? '?').'   created='.($mr->created_at ?? '?'));
            $this->line('  log             : '.($logLen > 0 ? "<info>VAR</info> ({$logLen} bayt)" : '<error>YOK/BOŞ</error>  -> PR imkansız (istemci log göndermedi)'));
            $this->line('  pr (gösterilen) : '.($mr->pr ?? '<comment>null (— gösterilir)</comment>'));
            if ($has('gnubg_pr')) {
                $this->line('  gnubg_pr        : '.($mr->gnubg_pr ?? '<comment>null</comment>')
                    .($has('gnubg_checker_pr') ? '   checker='.($mr->gnubg_checker_pr ?? 'null') : '')
                    .($has('gnubg_cube_pr') ? '   cube='.($mr->gnubg_cube_pr ?? 'null') : ''));
            }
            if ($has('gnubg_pr_at')) {
                $this->line('  gnubg_pr_at     : '.($mr->gnubg_pr_at
                    ? '<info>'.$mr->gnubg_pr_at.'</info> (gnubg’ye ULAŞILDI)'
                    : '<error>null</error> (gnubg’ye HİÇ ulaşılamadı = heal hedefi)'));
            }
            if ($has('opponent_pr')) {
                $this->line('  opponent_pr     : '.($mr->opponent_pr ?? '<comment>null</comment>')
                    .($has('gnubg_opponent_pr') ? '   gnubg_opponent_pr='.($mr->gnubg_opponent_pr ?? 'null') : ''));
            }
        }

        // 2) Config: PR modu
        $prMode = (string) config('gnubg.pr_mode', 'off');
        $this->line('');
        $this->line('GNUBG_PR_MODE     : '.$prMode.match ($prMode) {
            'authoritative' => '  <info>(gösterilen PR = gnubg; gnubg dolmazsa null -> "—")</info>',
            'shadow' => '  <comment>(yalnız gnubg_* shadow; gösterilen PR istemci wildbg — "—" ise istemci de yazmamış)</comment>',
            default => '  <error>(KAPALI -> gnubg PR HİÇ hesaplanmaz; job dispatch edilmez)</error>',
        });

        // 3) gnubg sağlığı (her instance ayrı)
        $this->line('');
        $bases = $gnubg->analyzeBases();
        $anyUp = false;
        foreach ($bases as $base) {
            $up = $gnubg->probeBase($base);
            $anyUp = $anyUp || $up;
            $this->line('  gnubg '.$base.' : '.$ok($up));
        }
        $this->line('  analyzeHealthy    : '.$ok($anyUp).($anyUp ? '' : '  <error>(hiçbir analyze instance ayakta değil -> job ertelenir/fırlar, PR "—" kalır)</error>'));

        // 4) Queue worker + failed_jobs
        $this->line('');
        $this->line('QUEUE_CONNECTION  : '.config('queue.default'));
        $pending = 0;
        $oldest = 0;
        $workerAlive = true;
        try {
            $pending = (int) DB::table('jobs')->count();
            $oldest = $pending > 0 ? (time() - (int) DB::table('jobs')->min('available_at')) : 0;
            $workerAlive = $pending === 0 || $oldest < 90;
            $this->line('  bekleyen iş       : '.$pending.'   en eski: '.$oldest.'sn   -> '
                .($pending === 0 ? 'boşta (bekleyen yok)' : ($workerAlive ? '<info>taze iş akıyor -> worker ÇALIŞIYOR</info>' : '<error>birikmiş -> worker KAPALI OLABILIR (tavla-queue restart)</error>')));
        } catch (\Throwable $e) {
            $this->line('  jobs tablosu      : <error>okunamadı</error> '.$e->getMessage());
        }
        $failedForThis = 0;
        $failedTotal = 0;
        if (Schema::hasTable('failed_jobs')) {
            try {
                $failedTotal = (int) DB::table('failed_jobs')->count();
                foreach ($rows as $mr) {
                    $failedForThis += (int) DB::table('failed_jobs')
                        ->where('payload', 'like', '%AnalyzeMatchPrJob%')
                        ->where('payload', 'like', '%:'.$mr->id.';%')
                        ->count();
                }
                $this->line('  başarısız iş      : toplam '.$failedTotal.($failedForThis > 0 ? '   <error>BU MAÇ İÇİN '.$failedForThis.' başarısız iş var (queue:failed ile incele)</error>' : ''));
            } catch (\Throwable $e) {
                $this->line('  failed_jobs       : <error>okunamadı</error> '.$e->getMessage());
            }
        }

        // 5) HÜKÜM
        $this->line('');
        $this->line('=== HÜKÜM ===');
        // SENTINEL-ZERO: gnubg_pr TAM 0.00 = gnubg maçı skorladı AMA 0 karar saydı (decisions=0) ->
        // "PR asla null olmasın" fallback'i sahte 0 döndürdü. Bir insan tam maçta 0.00 PR yapamaz
        // (bkz tavla:purge-sentinel-zero-pr). Bu "dolu" DEĞİL; kök = 0 sayılan karar (matching/threshold).
        $sentinelZero = $has('gnubg_pr') && $rows->contains(fn ($m) => $m->gnubg_pr !== null && abs((float) $m->gnubg_pr) < 0.005);
        $allHaveGnubg = $has('gnubg_pr') && $rows->every(fn ($m) => $m->gnubg_pr !== null && abs((float) $m->gnubg_pr) >= 0.005);
        $allTombstoned = $has('gnubg_pr_at') && $rows->every(fn ($m) => $m->gnubg_pr_at !== null && $m->gnubg_pr === null);
        $noLog = $rows->every(fn ($m) => empty($m->log));

        if (! in_array($prMode, ['shadow', 'authoritative'], true)) {
            $this->error('KÖK SEBEP: GNUBG_PR_MODE='.$prMode.' (KAPALI). gnubg PR hiç hesaplanmıyor. .env -> GNUBG_PR_MODE=authoritative + config:clear + FPM restart.');
        } elseif ($noLog) {
            $this->error('KÖK SEBEP: log YOK. İstemci maç logunu göndermemiş -> PR matematiksel olarak imkansız. (Yeni maçta tekrar dene; log gitmiyorsa istemci tarafı sorunu.)');
        } elseif ($sentinelZero) {
            $this->error('KÖK SEBEP: SAHTE 0.00 (sentinel). gnubg maçı skorladı ama 0 KARAR saydı -> "—"/0.00 görünür.');
            $this->line('  Neden 0 karar? Ya hamleler gnubg pozisyonuyla EŞLEŞMİYOR (skip) ya da hepsi "obvious/forced" sayıldı.');
            $this->line('  KESİN teşhis (karar-karar dökümü): <info>php artisan tavla:gnubg-pr '.$rows->first()->id.' --player=white --full</info>');
            $this->line('  "Toplam değerlendirilen" küçükse -> hamle-eşleşme bug’ı; büyük ama Sayılan=0 -> obvious eşiği.');
        } elseif ($allHaveGnubg) {
            $this->info('PR ZATEN DOLU (gnubg_pr yazılmış). Ekran "—" gösteriyorsa istemci bayat bundle/cache -> Ctrl+F5 (sonuç ekranı matchGnubgPr’ı yeniden çeksin).');
        } elseif ($allTombstoned) {
            $this->warn('NORMAL "—": gnubg’ye ulaşıldı ama skorlanacak karar yok (çok kısa maç / zorunlu hamleler / reconstructed rakip). PR gerçekten yok; bu bir hata değil.');
        } elseif (! $anyUp) {
            $this->error('KÖK SEBEP: gnubg servisi DÜŞÜK (hiçbir instance ayakta değil). SUNUCUDA: systemctl restart gnubg-analysis (ve varsa yedek birimler) -> sonra: php artisan tavla:gnubg-pr-heal');
        } elseif (! $workerAlive) {
            $this->error('KÖK SEBEP: queue worker KAPALI/BIRIKMİŞ (iş işlenmiyor). SUNUCUDA: systemctl restart tavla-queue -> job’lar akınca PR dolar.');
        } elseif ($failedForThis > 0) {
            $this->error('KÖK SEBEP: bu maçın PR işi failed_jobs’a düşmüş. İncele: php artisan queue:failed  ->  yeniden dene: php artisan queue:retry all (veya --redispatch).');
        } else {
            $this->warn('İş muhtemelen HÂLÂ KUYRUKTA / yeni bitti. gnubg+worker ayakta -> birkaç saniye/dakika içinde dolmalı. Hızlandırmak için --redispatch kullan.');
        }

        // 6) İsteğe bağlı yeniden kuyruğa alma
        if ($this->option('redispatch')) {
            if (! in_array($prMode, ['shadow', 'authoritative'], true)) {
                $this->warn('--redispatch atlandı: pr_mode kapalı (job zaten çalışmaz).');
            } elseif ($noLog) {
                $this->warn('--redispatch atlandı: log yok (analiz edilecek veri yok).');
            } else {
                foreach ($rows as $mr) {
                    if (! empty($mr->log)) {
                        AnalyzeMatchPrJob::dispatch($mr->id)->onConnection('database');
                        $this->info('  yeniden kuyruğa alındı: satır #'.$mr->id);
                    }
                }
                $this->info('Tamam. Worker çalışıyorsa (yukarıda ÇALIŞIYOR) PR birazdan dolar; değilse önce tavla-queue restart.');
            }
        } else {
            $this->line('');
            $this->comment('Bu maçı hemen yeniden analiz etmek için: php artisan tavla:pr-why '.$code.' --redispatch');
        }

        return self::SUCCESS;
    }
}
