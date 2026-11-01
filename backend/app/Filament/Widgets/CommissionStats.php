<?php

namespace App\Filament\Widgets;

use App\Models\Commission;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Cache;

/**
 * Maç komisyonu (rake) özeti — platformun bahisli maçlardan aldığı, dolaşımdan ÇIKAN coin.
 * Site coin'ini azaltan ana "sink" buradan izlenir. Kısa cache'li.
 */
class CommissionStats extends BaseWidget
{
    protected static ?int $sort = 4;

    protected function getStats(): array
    {
        $data = Cache::remember('commission:stats', 120, function () {
            $todayStart = now()->startOfDay();
            $monthStart = now()->startOfMonth();

            $today = Commission::query()->where('created_at', '>=', $todayStart)
                ->selectRaw('COALESCE(SUM(commission),0) sum, COUNT(*) cnt')->first();
            $month = (int) Commission::query()->where('created_at', '>=', $monthStart)->sum('commission');
            $all = Commission::query()
                ->selectRaw('COALESCE(SUM(commission),0) sum, COALESCE(AVG(pct),0) pct')->first();

            return [
                'todaySum' => (int) $today->sum,
                'todayCnt' => (int) $today->cnt,
                'month' => $month,
                'allSum' => (int) $all->sum,
                'avgPct' => round((float) $all->pct, 1),
            ];
        });

        $n = fn ($v) => number_format($v, 0, ',', '.');

        return [
            Stat::make('Bugün Maç Komisyonu', $n($data['todaySum']))
                ->description($data['todayCnt'].' bahisli maç')
                ->descriptionIcon('heroicon-m-scissors')
                ->color('success'),
            Stat::make('Bu Ay Komisyon', $n($data['month']))
                ->description('aydan bugüne')
                ->descriptionIcon('heroicon-m-calendar-days')
                ->color('success'),
            Stat::make('Toplam Komisyon', $n($data['allSum']))
                ->description('ort. oran %'.$data['avgPct'])
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('primary'),
        ];
    }
}
