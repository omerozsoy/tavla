<?php

namespace App\Console\Commands;

use App\Jobs\AnalyzeMatchPrJob;
use App\Models\MatchResult;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * gnubg PR SELF-HEAL (kalıcı "—" kalkanı).
 *
 * KÖK SORUN: gnubg servisi KISA süre down/yavaş/restart iken analiz edilen maçlar KALICI "—" ile
 * yaralanıyordu. AnalyzeMatchPrJob o an GnuBgClient::analyze()=null alır (servis fırlatmaz), evaluated=0
 * olur, HİÇBİR kolon yazmadan "tamamlandı" işaretlenir ve BİR DAHA çalışmaz -> maç sonsuza dek "—".
 *
 * ÇÖZÜM: Job artık gnubg down iken FIRLATIR (retry) ve gnubg'ye ULAŞILDIĞINDA (down değilken) skorlanacak
 * karar olmasa bile gnubg_pr_at'i "mezar taşı" olarak set eder. Böylece `gnubg_pr_at IS NULL` = "gnubg'ye
 * HİÇ ulaşılamadı" (outage'da yaralandı) demektir. Bu komut o maçları -- son N gün, log'u olanlar --
 * yeniden kuyruğa alır; gnubg dönünce PR dolar, analiz-dışı olanlar bir kez işlenip mezar taşı alır ve
 * bir daha buraya düşmez (döngü yok). Cron'da 15 dk'da bir; gnubg down iken kendini erteler (boşa iş yok).
 */
class GnubgPrHeal extends Command
{
    protected $signature = 'tavla:gnubg-pr-heal {--limit=50 : Bir çalışmada yeniden kuyruğa alınacak maç sayısı} {--days=3 : Kaç gün geriye bakılsın} {--dry-run : Sadece listele, dispatch etme}';

    protected $description = 'gnubg kesintisinde "—" kalan maçların PR analizini yeniden kuyruğa al (self-heal).';

    public function handle(GnuBgClient $gnubg): int
    {
        $mode = (string) config('gnubg.pr_mode', 'off');
        if (! in_array($mode, ['shadow', 'authoritative'], true)) {
            $this->info("gnubg.pr_mode={$mode} -> heal gerekmez (yalniz shadow/authoritative).");

            return self::SUCCESS;
        }
        if (! Schema::hasColumn('match_results', 'gnubg_pr_at')) {
            $this->warn('gnubg_pr_at kolonu yok -> heal atlandi.');

            return self::SUCCESS;
        }
        // gnubg down iken yeniden kuyruğa almak anlamsız (job yine null alır / fırlatır). Servis dönene
        // kadar bekle -> boşa iş + failed_jobs birikmesi yok. Bir sonraki cron nabzında tekrar dener.
        if (! $gnubg->analyzeHealthy()) {
            $this->warn('gnubg servisi erisilemez (hicbir analyze instance ayakta degil) -> heal ertelendi.');

            return self::SUCCESS;
        }

        $limit = max(1, (int) $this->option('limit'));
        $days = max(1, (int) $this->option('days'));
        $dry = (bool) $this->option('dry-run');

        // gnubg_pr_at NULL = "gnubg'ye HİÇ ulaşılamadı" (outage'da yaralandı ya da hiç denenmedi). Son N gün.
        // KAYNAK: (a) client log'u olan satırlar VEYA (b) log'suz ama hamleleri SUNUCUDA olan satırlar
        // (ForfeitLoss/MatchBackstop yedek satırları — rapor göndermeyen kaybeden). Job SUNUCU-OTORİTER
        // kaynaktan (match_moves) log'suz satırı da DOĞRU renkte analiz eder (analysisHc rakip satırından
        // türetir). Job reachable-ama-boş durumda mezar taşı (gnubg_pr_at) koyar -> sonsuz re-dispatch yok.
        $rows = MatchResult::query()
            ->whereNull('gnubg_pr_at')
            ->where('created_at', '>=', now()->subDays($days))
            ->where(function ($q) {
                $q->where(function ($q2) {
                    $q2->whereNotNull('log')->where('log', '!=', '');
                })->orWhereExists(function ($sub) {
                    $sub->selectRaw('1')->from('match_moves')
                        ->whereColumn('match_moves.room_code', 'match_results.room_code');
                });
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'luck_mwc']);

        if ($rows->isEmpty()) {
            $this->info('Yarali (gnubg_pr_at NULL) mac yok -> heal gerekmedi.');

            return self::SUCCESS;
        }

        if ($dry) {
            $this->info('DRY-RUN: '.$rows->count().' mac yeniden analiz edilecekti: '.$rows->pluck('id')->implode(','));

            return self::SUCCESS;
        }

        foreach ($rows as $row) {
            AnalyzeMatchPrJob::dispatch($row->id)->onConnection('database');
            // Log'suz yedek satırların ŞANSI da eksiktir; luck yoksa onu da kuyruğa al (job idempotent,
            // bozuk kaydı TAVLAI_LUCK_UNAVAILABLE ile karantinaya alır -> döngü yok).
            if ($row->luck_mwc === null) {
                \App\Jobs\AnalyzeMatchLuckJob::dispatch($row->id)->onConnection('database');
            }
        }
        $this->info($rows->count().' mac PR/sans analizi yeniden kuyruga alindi (heal). Worker isleyecek.');

        return self::SUCCESS;
    }
}
