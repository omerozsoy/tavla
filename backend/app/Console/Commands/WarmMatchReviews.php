<?php

namespace App\Console\Commands;

use App\Jobs\CacheMatchReviewJob;
use App\Models\MatchResult;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * GEÇMİŞ maçların "Analiz" ekranı review'ini BOŞ ZAMANDA önden önbelleğe alır (backfill).
 *
 * Analiz ekranının hamle-hamle gnubg review'i ağırdır (~saniyeler). CacheMatchReviewJob yalnız
 * bundan SONRA biten maçları önden ısıtır; eski maçlar ilk tıklamada bekletir. Bu komut o geçmiş
 * maçları da (log'u olan, henüz denenmemiş) parti parti kuyruğa alır -> zamanla hepsi anında açılır.
 *
 * İLERLEME GARANTİSİ: CacheMatchReviewJob gnubg erişilebilirken review üretemezse gnubg_review_at'e
 * mezar taşı koyar. Bu komut `gnubg_review_at IS NULL` (hiç denenmemiş) filtreler -> analiz-dışı
 * maçlar bir kez işlenip düşer, imleç hep yeni maçlara ilerler (sonsuz döngü yok). gnubg down iken
 * kendini erteler (boşa iş + failed_jobs yok). Cron'da seyrek + küçük parti -> canlı analizle yarışmaz.
 *
 * ponytail: "boş zaman" gerçek idle-tespiti değil, seyrek+küçük-parti trickle proxy'si; canlı yükle
 * çakışırsa --limit düşür / schedule aralığını artır.
 */
class WarmMatchReviews extends Command
{
    protected $signature = 'tavla:review-warmup {--limit=10 : Bir çalışmada kuyruğa alınacak maç sayısı} {--dry-run : Sadece listele, dispatch etme}';

    protected $description = 'Geçmiş maçların Analiz review\'ini boş zamanda önden önbelleğe al (backfill).';

    public function handle(GnuBgClient $gnubg): int
    {
        $mode = (string) config('gnubg.pr_mode', 'off');
        if (! in_array($mode, ['shadow', 'authoritative'], true)) {
            $this->info("gnubg.pr_mode={$mode} -> review warmup gerekmez (yalniz shadow/authoritative).");

            return self::SUCCESS;
        }
        if (! Schema::hasColumn('match_results', 'gnubg_review') || ! Schema::hasColumn('match_results', 'gnubg_review_at')) {
            $this->warn('gnubg_review / gnubg_review_at kolonu yok -> warmup atlandi.');

            return self::SUCCESS;
        }
        // gnubg down iken kuyruğa almak anlamsız (job da erteler). Servis dönene kadar bekle.
        if (! $gnubg->analyzeHealthy()) {
            $this->warn('gnubg servisi erisilemez -> review warmup ertelendi.');

            return self::SUCCESS;
        }

        $limit = max(1, (int) $this->option('limit'));
        $dry = (bool) $this->option('dry-run');

        // Hiç denenmemiş (gnubg_review_at NULL) + GERÇEK log'u olan (LENGTH>40; boş sarmalayıcı ~24
        // hariç — has_log ile aynı eşik). En yeni önce (yakın maçlar daha çok açılır). LENGTH hem
        // MySQL hem SQLite'ta var.
        $ids = MatchResult::query()
            ->whereNull('gnubg_review_at')
            ->whereNotNull('log')
            ->whereRaw('LENGTH(log) > 40')
            ->orderByDesc('id')
            ->limit($limit)
            ->pluck('id')
            ->all();

        if ($ids === []) {
            $this->info('Onbellege alinacak gecmis mac yok -> hepsi tamam.');

            return self::SUCCESS;
        }

        if ($dry) {
            $this->info('DRY-RUN: '.count($ids).' mac review warmup edilecekti: '.implode(',', $ids));

            return self::SUCCESS;
        }

        foreach ($ids as $id) {
            CacheMatchReviewJob::dispatch($id)->onConnection('database');
        }
        $this->info(count($ids).' mac review warmup kuyruga alindi. Worker isleyecek (aninda acilir olacak).');

        return self::SUCCESS;
    }
}
