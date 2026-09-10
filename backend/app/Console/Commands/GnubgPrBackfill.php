<?php

namespace App\Console\Commands;

use App\Jobs\AnalyzeMatchPrJob;
use App\Models\MatchResult;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A→Z gnubg BACKFILL: gecmis maclarin GOSTERILEN PR'ini gnubg'ye cek.
 *  - Hizli yol (varsayilan): gnubg_pr ZATEN hesaplanmis satirlarda pr := gnubg_pr (tek UPDATE,
 *    ucuz). pr_equity_lost/pr_decisions eski (istemci) kalir; sadece GOSTERILEN PR duzelir.
 *  - --rerun: her maci gnubg ile YENIDEN analiz et (AnalyzeMatchPrJob dispatch) -> pr + havuz
 *    totalleri (pr_equity_lost/pr_decisions) da gnubg olur. Agirdir (karar basi gnubg cagrisi).
 *
 * ONEMLI: --rerun icin GNUBG_PR_MODE=authoritative + worker YENIDEN BASLATILMIS olmali (worker
 * config'i cache'ler). Hizli yol her modda calisir.
 */
class GnubgPrBackfill extends Command
{
    protected $signature = 'tavla:gnubg-pr-backfill {--rerun : gnubg ile yeniden analiz (havuz totalleri dahil)} {--limit=0 : en fazla N mac (0=hepsi)} {--dry : yaz.}';

    protected $description = 'Gecmis maclarin gosterilen PR’ini gnubg degerine ceker (hizli kopya veya --rerun yeniden analiz).';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $limit = (int) $this->option('limit');

        if ($this->option('rerun')) {
            if ((string) config('gnubg.pr_mode', 'off') !== 'authoritative') {
                $this->error('--rerun icin GNUBG_PR_MODE=authoritative olmali (yoksa job pr’yi yazmaz). Iptal.');

                return self::FAILURE;
            }
            $q = MatchResult::whereNotNull('log');
            if ($limit > 0) {
                $q->limit($limit);
            }
            $ids = $q->orderByDesc('id')->pluck('id');
            $this->line($ids->count().' mac gnubg ile yeniden analiz edilecek (worker isler).');
            if ($dry) {
                $this->warn('--dry: dispatch YOK.');

                return self::SUCCESS;
            }
            foreach ($ids as $id) {
                AnalyzeMatchPrJob::dispatch($id)->onConnection('database');
            }
            $this->info('Dispatch edildi. Worker calisiyor olmali; ilerlemeyi tavla:gnubg-status ile izle.');

            return self::SUCCESS;
        }

        // Hizli yol: pr := gnubg_pr (gnubg_pr dolu + pr farkli olanlar)
        if (! Schema::hasColumn('match_results', 'gnubg_pr')) {
            $this->error('gnubg_pr kolonu yok.');

            return self::FAILURE;
        }
        $q = MatchResult::whereNotNull('gnubg_pr')
            ->where(function ($w) {
                $w->whereNull('pr')->orWhereColumn('pr', '!=', 'gnubg_pr');
            });
        $count = (clone $q)->count();
        $this->line("Hizli kopya: gnubg_pr dolu, pr != gnubg_pr olan $count mac.");
        $this->line('(pr := gnubg_pr; havuz totalleri istemci kalir. Tam gnubg havuzu icin --rerun.)');
        if ($dry) {
            $this->warn('--dry: yazma YOK.');

            return self::SUCCESS;
        }
        $n = 0;
        (clone $q)->orderByDesc('id')->chunkById(200, function ($rows) use (&$n) {
            foreach ($rows as $r) {
                DB::table('match_results')->where('id', $r->id)->update(['pr' => $r->gnubg_pr]);
                $n++;
            }
        });
        $this->info("$n mac guncellendi (pr = gnubg_pr).");

        return self::SUCCESS;
    }
}
