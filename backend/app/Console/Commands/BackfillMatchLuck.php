<?php

namespace App\Console\Commands;

use App\Jobs\AnalyzeMatchLuckJob;
use App\Models\MatchResult;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * gnubg ŞANS (luck) BACKFILL: luck_mwc'si BOŞ geçmiş maçlar için AnalyzeMatchLuckJob'ı yeniden
 * dispatch eder -> Maç Özeti'nde "Jokerler" + "Şans (Equity)" + MWC%% dolar.
 *
 * NEDEN GEREKLİ: async şans job'u queue worker'ıyla işlenir. Queue KAPALIYKEN biten maçlarda
 * job dispatch edilmiş ama İŞLENMEMİŞ olur -> luck_mwc/emg/jokers null kalır ("—"). Queue tekrar
 * açılınca bu komut o maçları yeniden kuyruğa alır. Job idempotenttir (dolu satırı atlar).
 *
 * ÖNEMLİ:
 *  - Queue worker ÇALIŞIYOR olmalı (Plesk > Laravel Toolkit > Queue: Enabled).
 *  - Online maç: şans, İKİ oyuncunun logu BİRLEŞTİRİLEREK hesaplanır -> rakip satırı da olmalı;
 *    tek-taraflı (rakip hiç raporlamamış) satırlar zararsızca döner (luck null kalır).
 *  - gnubg servisi jokers'ı yayan güncel sürümde değilse luck_emg/mwc dolar ama luck_jokers null
 *    kalır -> deploy.sh gnubg-analysis'i /opt'a senkronlar + restart eder.
 */
class BackfillMatchLuck extends Command
{
    protected $signature = 'matches:backfill-luck {--limit=0 : en fazla N satır (0=hepsi)} {--days=0 : yalnız son N gün (0=hepsi)} {--dry : dispatch YOK, yalnız say}';

    protected $description = 'luck_mwc boş maçlar için gnubg şans job’unu yeniden dispatch eder (Jokerler + Şans Equity dolar).';

    public function handle(): int
    {
        if (! Schema::hasColumn('match_results', 'luck_mwc')) {
            $this->error('luck_mwc kolonu yok (migration koşmadı).');

            return self::FAILURE;
        }
        $limit = (int) $this->option('limit');
        $days = (int) $this->option('days');
        $dry = (bool) $this->option('dry');

        $q = MatchResult::whereNull('luck_mwc')->whereNotNull('log');
        if ($days > 0) {
            $q->where('created_at', '>', now()->subDays($days));
        }
        $ids = (clone $q)->orderByDesc('id')
            ->when($limit > 0, fn ($x) => $x->limit($limit))
            ->pluck('id');

        $this->line($ids->count().' maç için şans job dispatch edilecek (queue worker işler).');
        if ($dry) {
            $this->warn('--dry: dispatch YOK.');

            return self::SUCCESS;
        }
        foreach ($ids as $id) {
            AnalyzeMatchLuckJob::dispatch($id)->onConnection('database');
        }
        $this->info('Dispatch edildi. Queue: Enabled olmalı; işlendikçe luck_mwc/emg/jokers dolar.');

        return self::SUCCESS;
    }
}
