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
        $log = $decoded['log'];
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
        if ($upd !== []) {
            MatchResult::where('id', $mr->id)->update($upd); // query-builder -> fillable gerekmez
        }

        Log::info('gnubg PR shadow', [
            'id' => $mr->id, 'player' => $player,
            'client_pr' => $mr->pr, 'gnubg_pr' => round((float) $overall, 2),
            'checker' => $chk['pr'], 'cube' => $cube['pr'],
            'chk_dec' => $chk['decisions'], 'chk_eval' => $chk['evaluated'], 'chk_skip' => $chk['skipped'],
        ]);
    }
}
