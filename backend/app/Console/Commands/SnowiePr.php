<?php

namespace App\Console\Commands;

use App\Jobs\AnalyzeMatchSnowieJob;
use App\Models\MatchResult;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * OTORİTER PR geçişi (Aşama 1): stored maçların PR'ını gnubg'nin KENDİ "Snowie error rate"ine çeker
 * (XG birebir; review-log equity-toplamı ~6x şişiyordu — maç 7669 bizim 327, gnubg 51.4, XG 56.24).
 * Her maç için bir ağır `/analyzematch` çağrısı -> AnalyzeMatchSnowieJob (reviews-bulk, paralel worker).
 *
 * RESUMABLE: pr_shield_at imlecini yeniden kullanır (job başarıda now() damgalar). Backfill'den ÖNCE
 * imleç NULL'lanmalı (DB: UPDATE match_results SET pr_shield_at=NULL WHERE gnubg_review IS NOT NULL).
 * --limit koşu başına dispatch tavanı; worker kuyruğu off-peak boşaltır (~12 bin ağır çağrı, saatler).
 */
class SnowiePr extends Command
{
    protected $signature = 'tavla:snowie-pr {--limit=20000 : Bu koşuda kuyruğa alınacak maç} {--dry-run}';

    protected $description = 'Stored maç PR\'larını gnubg Snowie error rate\'ine çek (XG-birebir, Aşama 1 backfill).';

    public function handle(GnuBgClient $gnubg): int
    {
        if (! Schema::hasColumn('match_results', 'pr_shield_at')) {
            $this->warn('pr_shield_at imleç kolonu yok -> migrate bekliyor.');

            return self::SUCCESS;
        }
        if (! $gnubg->analyzeHealthy()) {
            $this->warn('gnubg erişilemez -> ertelendi (job da erteler, boşa iş yok).');

            return self::SUCCESS;
        }
        $limit = max(1, (int) $this->option('limit'));
        // GERÇEK log'lu, odalı, henüz Snowie'lenmemiş (pr_shield_at NULL) maçlar. En yeni önce.
        $q = MatchResult::query()
            ->whereNotNull('room_code')
            ->whereNotNull('log')
            ->whereRaw('LENGTH(log) > 40')
            ->whereNull('pr_shield_at');
        $remaining = (clone $q)->count();
        $pick = $q->orderByDesc('id')->limit($limit)->pluck('id')->all();
        if ($pick === []) {
            $this->info('Snowie backfill: işlenecek maç yok -> hepsi tamam.');

            return self::SUCCESS;
        }
        if ($this->option('dry-run')) {
            $this->info('DRY-RUN: '.count($pick)." maç dispatch edilecekti (kalan ~{$remaining}).");

            return self::SUCCESS;
        }
        foreach ($pick as $id) {
            AnalyzeMatchSnowieJob::dispatch($id)->onConnection('database')->onQueue('reviews-bulk');
        }
        $this->info(count($pick)." maç Snowie-PR için kuyruğa alındı (reviews-bulk). Kalan ~{$remaining}. Worker işleyecek.");

        return self::SUCCESS;
    }
}
