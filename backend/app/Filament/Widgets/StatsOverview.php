<?php

namespace App\Filament\Widgets;

use App\Models\MatchResult;
use App\Models\Payment;
use App\Models\User;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends BaseWidget
{
    protected static ?int $sort = -3; // en ustte

    protected function getStats(): array
    {
        // Gelir: basarili (paid) odemelerin toplami. amount kurus -> TL.
        $revenueKurus = (int) Payment::where('status', 'paid')->sum('amount');
        $revenueTl = $revenueKurus / 100;

        // Aylik gelir (son 30 gun)
        $monthKurus = (int) Payment::where('status', 'paid')
            ->where('created_at', '>=', now()->subDays(30))
            ->sum('amount');

        $users = User::count();
        // Aktif Premium: plan free degil ve suresi gecmemis
        $premium = User::where('plan', '!=', 'free')
            ->whereNotNull('plan')
            ->where(function ($q) {
                $q->whereNull('plan_until')->orWhere('plan_until', '>', now());
            })->count();

        $matches = MatchResult::count();
        $paidCount = Payment::where('status', 'paid')->count();

        $fmt = fn ($n) => number_format($n, 0, ',', '.');

        return [
            Stat::make('Toplam Gelir', $fmt($revenueTl).' ₺')
                ->description($fmt($monthKurus / 100).' ₺ (son 30 gün)')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('success'),
            Stat::make('Ödeme (başarılı)', $fmt($paidCount))
                ->description('tamamlanan işlem')
                ->color('success'),
            Stat::make('Toplam Üye', $fmt($users))
                ->description($fmt($premium).' aktif Premium')
                ->descriptionIcon('heroicon-m-user-group')
                ->color('warning'),
            Stat::make('Oynanan Maç', $fmt($matches))
                ->description('kayıtlı sonuç')
                ->descriptionIcon('heroicon-m-trophy')
                ->color('primary'),
        ];
    }
}
