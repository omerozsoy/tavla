<?php

namespace App\Filament\Widgets;

use App\Models\User;
use App\Models\WalletTransaction;
use App\Support\WalletBreakdown;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\HtmlString;

/**
 * Site coin ekonomisi özeti (admin ana sayfa). Kısa cache'li.
 *  - Sitedeki toplam coin + düne göre (bugünkü net) değişim
 *  - Bugün sistemden dağıtılan coin, kaynak kaynak (defter type'ına göre; oyuncu-arası
 *    maç transferi hariç = "sistemden edinilmiş")
 */
class CoinStats extends BaseWidget
{
    protected static ?int $sort = 3;

    protected function getStats(): array
    {
        $data = Cache::remember('coin:stats', 120, function () {
            $todayStart = now()->startOfDay();

            $totalCoins = (int) User::query()->sum('coins');
            // Bugünkü net değişim = bugünkü tüm defter hareketlerinin toplamı (maç net=0, kalan=mint/yakım).
            $todayDelta = (int) WalletTransaction::query()
                ->where('created_at', '>=', $todayStart)
                ->sum('amount');

            // Bugün sistemden dağıtılan coin: pozitif krediler, kaynak (type) bazında.
            // 'match' kategorisi oyuncular arası transferdir → "sistemden" değil, hariç tut.
            $rows = WalletTransaction::query()
                ->where('created_at', '>=', $todayStart)
                ->where('amount', '>', 0)
                ->selectRaw('type, SUM(amount) as credited')
                ->groupBy('type')
                ->get();

            $dist = [];
            $distTotal = 0;
            foreach ($rows as $r) {
                $type = (string) $r->type;
                if (WalletBreakdown::categoryOf($type) === 'match') {
                    continue;
                }
                $amt = (int) $r->credited;
                $distTotal += $amt;
                $dist[] = [WalletBreakdown::typeLabel($type), $amt];
            }
            usort($dist, fn ($a, $b) => $b[1] <=> $a[1]);

            return [
                'totalCoins' => $totalCoins,
                'todayDelta' => $todayDelta,
                'dist' => $dist,
                'distTotal' => $distTotal,
            ];
        });

        $up = $data['todayDelta'] >= 0;
        $delta = ($up ? '+' : '').number_format($data['todayDelta'], 0, ',', '.');

        $lines = array_map(
            fn ($d) => e($d[0]).': '.number_format($d[1], 0, ',', '.'),
            $data['dist']
        );

        return [
            Stat::make('Sitedeki Toplam Coin', number_format($data['totalCoins'], 0, ',', '.'))
                ->description($delta.' bugün (düne göre)')
                ->descriptionIcon($up ? 'heroicon-m-arrow-trending-up' : 'heroicon-m-arrow-trending-down')
                ->color($up ? 'success' : 'danger'),
            Stat::make('Bugün Dağıtılan Coin', number_format($data['distTotal'], 0, ',', '.'))
                ->description(new HtmlString($lines ? implode('<br>', $lines) : 'henüz yok'))
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('warning'),
        ];
    }
}
