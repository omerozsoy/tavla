<?php

namespace App\Jobs;

use App\Models\MatchResult;
use App\Services\Analysis\AnalysisOrchestrator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Bir maçın logunu gnubg orkestratörüyle analiz edip PR'ı ARKA PLANDA (queue) hesaplar (shadow).
 * Sonucu match_results.gnubg_* kolonlarına yazar + client PR ile loglar. Gösterilen/otoriter PR'a
 * DOKUNMAZ. Ağır (~karar başına bir gnubg çağrısı) olduğu için senkron reportRating'i bloklamaz.
 */
class AnalyzeMatchPrJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;      // tekrar deneme yok (gnubg down ise sessiz geç)

    public int $timeout = 600;  // 60+ gnubg çağrısı olabilir

    public function __construct(public int $matchResultId) {}

    public function handle(AnalysisOrchestrator $orch): void
    {
        $mr = MatchResult::find($this->matchResultId);
        if (! $mr || empty($mr->log)) {
            return;
        }
        $decoded = json_decode($mr->log, true);
        if (! is_array($decoded) || empty($decoded['log'])) {
            return;
        }
        $player = $decoded['hc'] ?? 'white';
        // HAM log (fill DAHİL) — orchestrator fill/cube'u kendisi eler (PR sonucu değişmez). Filtreleyip
        // reindex ETMİYORUZ ki perDecision.logIndex, mr->log indeksleriyle HİZALI kalsın (Hata Günlüğü
        // Adım 2: gnubg loss'unu doğru karara eşler).
        $log = is_array($decoded['log']) ? $decoded['log'] : [];
        $ml = (int) ($mr->match_length ?? 0);

        try {
            $chk = $orch->checkerPr($log, $player, $ml, 2);
            $cube = $orch->cubePr($log, $player, $ml);
        } catch (\Throwable $e) {
            Log::warning('gnubg PR job hata', ['id' => $mr->id, 'err' => $e->getMessage()]);

            return;
        }

        $totLoss = $chk['loss'] + $cube['loss'];
        $totDec = $chk['decisions'] + $cube['decisions'];
        $overall = $totDec > 0 ? ($totLoss / $totDec) * 500 : ($chk['pr'] ?: $cube['pr']);

        $upd = [];
        foreach ([
            'gnubg_pr' => round((float) $overall, 2),
            'gnubg_checker_pr' => round((float) $chk['pr'], 2),
            'gnubg_cube_pr' => round((float) $cube['pr'], 2),
        ] as $col => $val) {
            if (Schema::hasColumn('match_results', $col)) {
                $upd[$col] = $val;
            }
        }
        if (Schema::hasColumn('match_results', 'gnubg_pr_at')) {
            $upd['gnubg_pr_at'] = now();
        }

        // ANA KURAL (A→Z gnubg): pr_mode=authoritative ise GOSTERILEN/OTORITER PR = gnubg (cubeful
        // EMG, match-aware) olur; istemci wildbg (kübsüz para, 1-ply) PR'i EZILIR. Boylece "Maç
        // Analizleri"ndeki PR + kariyer havuzu (pr_equity_lost/pr_decisions) XG ile ayni sınıf motordan
        // gelir. gnubg gercekten karar degerlendirdiyse (totDec>0) yaz; degilse istemci PR'i kalir
        // (servis down -> zaten yukarida return; graceful fallback). Rating/Elo win/loss'tan gelir,
        // PR degismesinden ETKILENMEZ.
        if ((string) config('gnubg.pr_mode', 'off') === 'authoritative' && $totDec > 0) {
            foreach ([
                'pr' => round((float) $overall, 2),
                'pr_equity_lost' => round((float) $totLoss, 6),
                'pr_decisions' => $totDec,
            ] as $col => $val) {
                if (Schema::hasColumn('match_results', $col)) {
                    $upd[$col] = $val;
                }
            }
        }

        if ($upd !== []) {
            MatchResult::where('id', $mr->id)->update($upd); // query-builder -> fillable gerekmez
        }

        // ADIM 2 (HAKEM=gnubg): Hata Günlüğü'nü gnubg per-karar loss'uyla YENİDEN üret. reportRating'te
        // senkron olarak wildbg loss'uyla üretilmişti; burada (async) gnubg loss'uyla ezilir. logIndex ->
        // gnubg loss haritası ErrorJournal'a verilir (yalnız insanın kararları; rakip wildbg kalır).
        try {
            $lossByIndex = [];
            foreach (($chk['perDecision'] ?? []) as $d) {
                if (isset($d['logIndex'])) {
                    $lossByIndex[(int) $d['logIndex']] = (float) $d['loss'];
                }
            }
            if ($lossByIndex !== []) {
                $freshMr = MatchResult::find($mr->id) ?? $mr;
                app(\App\Services\ErrorJournalService::class)->analyzeMatch($freshMr, true, $lossByIndex);
                app(\App\Services\DiceStatisticsService::class)->invalidate((int) $mr->user_id);
            }
        } catch (\Throwable $e) {
            Log::warning('gnubg Hata Günlüğü re-gen hata', ['id' => $mr->id, 'err' => $e->getMessage()]);
        }

        Log::info('gnubg PR shadow', [
            'id' => $mr->id, 'player' => $player,
            'client_pr' => $mr->pr, 'gnubg_pr' => round((float) $overall, 2),
            'checker' => $chk['pr'], 'cube' => $cube['pr'],
            'chk_dec' => $chk['decisions'], 'chk_eval' => $chk['evaluated'], 'chk_skip' => $chk['skipped'],
        ]);
    }
}
