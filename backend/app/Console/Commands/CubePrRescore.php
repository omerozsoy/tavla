<?php

namespace App\Console\Commands;

use App\Jobs\CacheMatchReviewJob;
use App\Models\MatchResult;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * KÜP PR BACKFILL (skor-farkında): eski gnubg review'leri küp kararlarını DAİMA 0-0 skorunda
 * hesaplıyordu (gnubg_service._review_cube score=None) -> maçın 2+. oyunundaki küp kararları yanlış
 * equity/kayıp -> şişik küp PR (ör. 1-away'de "too-good" redouble "hata" sayılıyordu). Fix skoru
 * geçirir; bu komut KÜP KARARI OLAN geçmiş maçları force ile YENİDEN review'a alır. CacheMatchReviewJob
 * taze review üretir + PR'ı review'dan yeniden yazar (writePrFromReview) -> hem review hem gnubg_pr düzelir.
 *
 * TEKRAR-ÇALIŞTIRILABİLİR: --before cutoff'tan ESKİ gnubg_review_at olanları seçer; job bitince _at=now()
 * olur -> sonraki çalışma onu atlar (imleç hep ilerler, çift-iş yok). --limit ile throttle (deep review
 * AĞIR ~saniyeler, canlı gnubg ile yarışır) -> cron'da küçük parti + off-peak önerilir.
 *
 * ponytail: game>0 filtresi YOK bilerek — game-1-only küp maçını yeniden review etmek ZARARSIZ (aynı
 * sonuç, skor zaten 0-0) ama JSON tarama/işaret maliyetini keser; --before cutoff her maçı BİR kez işler.
 */
class CubePrRescore extends Command
{
    protected $signature = 'tavla:cube-pr-rescore
        {--limit=200 : Bir çalışmada kuyruğa alınacak maç sayısı}
        {--before= : Bu ISO zamandan ESKİ review_at olanlar (varsayılan: komut başlangıcı). Fix deploy anını ver.}
        {--ids= : Yalnız bu id\'ler (virgüllü) — nokta atışı backfill}
        {--dry-run : Sadece listele, dispatch etme}';

    protected $description = 'Küp kararı olan geçmiş maçları skor-farkında küp analiziyle YENİDEN review\'a al (backfill).';

    public function handle(GnuBgClient $gnubg): int
    {
        $mode = (string) config('gnubg.pr_mode', 'off');
        if (! in_array($mode, ['shadow', 'authoritative'], true)) {
            $this->info("gnubg.pr_mode={$mode} -> rescore gerekmez (yalniz shadow/authoritative).");

            return self::SUCCESS;
        }
        if (! Schema::hasColumn('match_results', 'gnubg_review') || ! Schema::hasColumn('match_results', 'gnubg_review_at')) {
            $this->warn('gnubg_review / gnubg_review_at kolonu yok -> rescore atlandi.');

            return self::SUCCESS;
        }
        if (! $gnubg->analyzeHealthy()) {
            $this->warn('gnubg servisi erisilemez -> rescore ertelendi (job da erteler, bosa is yok).');

            return self::SUCCESS;
        }

        $limit = max(1, (int) $this->option('limit'));
        $dry = (bool) $this->option('dry-run');
        $before = $this->option('before') ? \Carbon\Carbon::parse($this->option('before')) : now();
        $ids = array_filter(array_map('intval', explode(',', (string) $this->option('ids'))));

        // Küp kararı olan (cube_decisions>0), review'li, GERÇEK log'lu, cutoff'tan ESKİ review_at'li maçlar.
        // En yeni önce (yakın maçlar öncelik). _at>=before olanlar (bu backfill'de düzelmiş) atlanır.
        $q = MatchResult::query()
            ->where('cube_decisions', '>', 0)
            ->whereNotNull('gnubg_review')
            ->whereNotNull('log')
            ->whereRaw('LENGTH(log) > 40')
            ->where(function ($w) use ($before) {
                $w->whereNull('gnubg_review_at')->orWhere('gnubg_review_at', '<', $before);
            });
        if ($ids !== []) {
            $q->whereIn('id', $ids);
        }
        $pick = $q->orderByDesc('id')->limit($limit)->pluck('id')->all();

        if ($pick === []) {
            $this->info('Rescore edilecek kup maci yok -> hepsi tamam.');

            return self::SUCCESS;
        }

        $remaining = (clone $q)->count();
        if ($dry) {
            $this->info('DRY-RUN: '.count($pick)." mac rescore edilecekti (toplam kalan ~{$remaining}): ".implode(',', $pick));

            return self::SUCCESS;
        }

        foreach ($pick as $id) {
            CacheMatchReviewJob::dispatch($id, 2, true)->onConnection('database')->onQueue('reviews-bulk');
        }
        $this->info(count($pick)." mac force-rescore kuyruga alindi (reviews-bulk). Toplam kalan ~{$remaining}. Worker isleyecek.");

        return self::SUCCESS;
    }
}
