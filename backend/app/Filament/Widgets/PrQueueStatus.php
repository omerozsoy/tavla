<?php

namespace App\Filament\Widgets;

use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * PR ANALİZ KUYRUĞU (canlı): gnubg PR işlerinin panelden izlenmesi. "Boş PR" düzeltme (heal) ilerlemesi
 * buradan takip edilir — CLI gerekmez. 10 sn'de bir tazelenir.
 *   - Bekleyen iş        : jobs tablosu (worker işleyecek). Worker canlıysa açıklamada belirtilir.
 *   - PR bekleyen maç    : gnubg_pr_at NULL + log'u olan maçlar = henüz PR'ı hesaplanmamış (heal hedefi).
 *   - Başarısız iş       : failed_jobs (0 beklenir; gnubg 4 instance ayaktayken olmamalı).
 *   - Son 24s dolan PR   : gnubg_pr_at son 24s içinde yazılmış = throughput (heal çalışıyor mu?).
 */
class PrQueueStatus extends BaseWidget
{
    protected static ?int $sort = -3; // Servis Durumu'nun hemen altında

    protected static ?string $pollingInterval = '10s'; // canlı izleme

    protected function getStats(): array
    {
        $fmt = fn ($n) => number_format((int) $n, 0, ',', '.');

        // Bekleyen kuyruk işleri (çoğu AnalyzeMatchPrJob / luck). Worker canlılık damgası (AppServiceProvider).
        $pending = $this->safeCount(fn () => (int) DB::table('jobs')->count());
        $hb = (int) (Cache::get('queue:worker:heartbeat') ?? 0);
        $workerAlive = $hb > 0 && (time() - $hb) < 60;

        $failed = $this->safeCount(function () {
            return Schema::hasTable('failed_jobs') ? (int) DB::table('failed_jobs')->count() : 0;
        });

        // PR bekleyen maç = gnubg'ye hiç ulaşılamamış (gnubg_pr_at NULL) + log'u olan. Heal bunları eritir.
        $awaitingPr = 0;
        $filledToday = 0;
        if (Schema::hasColumn('match_results', 'gnubg_pr_at')) {
            $awaitingPr = $this->safeCount(fn () => (int) DB::table('match_results')
                ->whereNull('gnubg_pr_at')
                ->whereNotNull('log')
                ->where('log', '!=', '')
                ->count());
            $filledToday = $this->safeCount(fn () => (int) DB::table('match_results')
                ->where('gnubg_pr_at', '>=', now()->subDay())
                ->count());
        }

        return [
            Stat::make('Bekleyen İş (kuyruk)', $fmt($pending))
                ->description($workerAlive ? 'Worker canlı — işleniyor' : 'Worker nabzı yok (kapalı olabilir)')
                ->descriptionIcon($workerAlive ? 'heroicon-m-bolt' : 'heroicon-m-exclamation-triangle')
                ->color($pending === 0 ? 'success' : ($workerAlive ? 'warning' : 'danger')),
            Stat::make('PR Bekleyen Maç', $fmt($awaitingPr))
                ->description('gnubg PR henüz yok (heal eritir)')
                ->descriptionIcon('heroicon-m-clock')
                ->color($awaitingPr === 0 ? 'success' : 'warning'),
            Stat::make('Son 24s Dolan PR', $fmt($filledToday))
                ->description('gnubg ile hesaplanan maç')
                ->descriptionIcon('heroicon-m-check-circle')
                ->color('success'),
            Stat::make('Başarısız İş', $fmt($failed))
                ->description($failed === 0 ? 'Temiz' : '"Başarısız İşler" sayfasına bak')
                ->descriptionIcon($failed === 0 ? 'heroicon-m-check-circle' : 'heroicon-m-x-circle')
                ->color($failed === 0 ? 'success' : 'danger'),
        ];
    }

    /** DB okuma hatasında panel patlamasın -> 0. */
    private function safeCount(callable $fn): int
    {
        try {
            return (int) $fn();
        } catch (\Throwable $e) {
            return 0;
        }
    }
}
