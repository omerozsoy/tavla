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
        $since = now()->subDay(); // son 24 saat penceresi — tüm kritik kartlar bunu gösterir

        // Gelir: basarili (paid) odemeler. Ana deger son 24s, yasam-boyu toplam aciklamada.
        $rev24Tl = (int) Payment::where('status', 'paid')
            ->where('created_at', '>=', $since)->sum('amount') / 100;
        $revAllTl = (int) Payment::where('status', 'paid')->sum('amount') / 100;

        $paid24 = Payment::where('status', 'paid')->where('created_at', '>=', $since)->count();

        $users = User::count();
        $newUsers24 = User::where('created_at', '>=', $since)->count();

        $matches24 = MatchResult::where('created_at', '>=', $since)->count();
        $matchesAll = MatchResult::count();

        $fmt = fn ($n) => number_format($n, 0, ',', '.');

        return [
            Stat::make('Gelir (son 24 saat)', $fmt($rev24Tl).' ₺')
                ->description('toplam: '.$fmt($revAllTl).' ₺')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('success'),
            Stat::make('Ödeme (son 24 saat)', $fmt($paid24))
                ->description('başarılı işlem')
                ->color('success'),
            Stat::make('Yeni Üye (son 24 saat)', $fmt($newUsers24))
                ->description('toplam üye: '.$fmt($users))
                ->descriptionIcon('heroicon-m-user-group')
                ->color('warning'),
            Stat::make('Oynanan Maç (son 24 saat)', $fmt($matches24))
                ->description('toplam: '.$fmt($matchesAll))
                ->descriptionIcon('heroicon-m-trophy')
                ->color('primary'),
        ];
    }
}
