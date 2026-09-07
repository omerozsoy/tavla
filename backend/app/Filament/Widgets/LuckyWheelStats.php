<?php

namespace App\Filament\Widgets;

use App\Models\LuckyWheelReward;
use App\Models\LuckyWheelSpin;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Cache;

/**
 * Şans Çarkı istatistik özeti. Ağır JSON taramasını önlemek için kısa cache'li.
 */
class LuckyWheelStats extends BaseWidget
{
    protected static ?int $sort = 3;

    // Yalnızca çark kurulu ise (ödül varsa) göster.
    public static function canView(): bool
    {
        return LuckyWheelReward::query()->exists();
    }

    protected function getStats(): array
    {
        $data = Cache::remember('lw:stats', 120, function () {
            $todayStart = now()->startOfDay();

            $totalSpins = LuckyWheelSpin::count();
            $todaySpins = LuckyWheelSpin::where('created_at', '>=', $todayStart)->count();
            $activeUsersToday = LuckyWheelSpin::where('created_at', '>=', $todayStart)->distinct('user_id')->count('user_id');

            // Coin dağıtımı: snapshot JSON'dan (bugün küçük; toplam kısa cache ile).
            $todayCoins = LuckyWheelSpin::where('created_at', '>=', $todayStart)
                ->get(['reward_snapshot'])
                ->sum(fn ($s) => ($s->reward_snapshot['type'] ?? null) === 'COIN' ? (int) ($s->reward_snapshot['amount'] ?? 0) : 0);
            $totalCoins = LuckyWheelSpin::query()
                ->get(['reward_snapshot'])
                ->sum(fn ($s) => ($s->reward_snapshot['type'] ?? null) === 'COIN' ? (int) ($s->reward_snapshot['amount'] ?? 0) : 0);

            // En çok çıkan ödül (denormalize total_won).
            $top = LuckyWheelReward::query()->orderByDesc('total_won')->first();

            return [
                'totalSpins' => $totalSpins,
                'todaySpins' => $todaySpins,
                'activeUsersToday' => $activeUsersToday,
                'todayCoins' => $todayCoins,
                'totalCoins' => $totalCoins,
                'topName' => $top?->name,
                'topWon' => (int) ($top?->total_won ?? 0),
            ];
        });

        return [
            Stat::make('Bugünkü Çevirme', number_format($data['todaySpins'], 0, ',', '.'))
                ->description(number_format($data['totalSpins'], 0, ',', '.').' toplam')
                ->descriptionIcon('heroicon-m-arrow-path')
                ->color('primary'),
            Stat::make('Bugün Dağıtılan Coin', number_format($data['todayCoins'], 0, ',', '.'))
                ->description(number_format($data['totalCoins'], 0, ',', '.').' toplam')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('warning'),
            Stat::make('Bugün Aktif Kullanıcı', number_format($data['activeUsersToday'], 0, ',', '.'))
                ->description('çeviren kişi')
                ->descriptionIcon('heroicon-m-user-group')
                ->color('success'),
            Stat::make('En Çok Çıkan', $data['topName'] ?: '—')
                ->description($data['topName'] ? number_format($data['topWon'], 0, ',', '.').' kez' : 'henüz yok')
                ->descriptionIcon('heroicon-m-trophy')
                ->color('primary'),
        ];
    }
}
