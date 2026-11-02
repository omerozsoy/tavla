<?php

namespace App\Filament\Widgets;

use App\Models\Commission;
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
 *  - Bugün ÜRETİLEN coin (sistem kredileri, kaynak kaynak; maç = oyuncu-arası, hariç)
 *  - Bugün YAKILAN coin (sistem borçları + maç komisyonu, kaynak kaynak)
 *  - Coin Akışı (net = üretilen − yakılan). Net < 0 = dolaşım küçülüyor (hedef).
 */
class CoinStats extends BaseWidget
{
    protected static ?int $sort = 3;

    protected function getStats(): array
    {
        $data = Cache::remember('coin:stats', 120, function () {
            $todayStart = now()->startOfDay();

            $totalCoins = (int) User::query()->sum('coins');

            // Bugünkü tüm defter hareketleri, type bazında kredi/borç ayrı.
            $rows = WalletTransaction::query()
                ->where('created_at', '>=', $todayStart)
                ->selectRaw('type,
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as credited,
                    SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) as debited')
                ->groupBy('type')
                ->get();

            // 'match' kategorisi oyuncular arası transferdir (net=0; gerçek yakım = komisyon).
            // Bu yüzden maç kredi/borçlarını atla, komisyonu ayrı yakım satırı olarak ekle.
            $mint = [];
            $mintTotal = 0;
            $burn = [];
            $burnTotal = 0;
            foreach ($rows as $r) {
                $type = (string) $r->type;
                if (WalletBreakdown::categoryOf($type) === 'match') {
                    continue;
                }
                $label = WalletBreakdown::typeLabel($type);
                $cr = (int) $r->credited;
                $db = (int) $r->debited;
                if ($cr > 0) {
                    $mint[] = [$label, $cr];
                    $mintTotal += $cr;
                }
                if ($db > 0) {
                    $burn[] = [$label, $db];
                    $burnTotal += $db;
                }
            }

            $commToday = (int) Commission::query()->where('created_at', '>=', $todayStart)->sum('commission');
            if ($commToday > 0) {
                $burn[] = ['Maç komisyonu', $commToday];
                $burnTotal += $commToday;
            }

            usort($mint, fn ($a, $b) => $b[1] <=> $a[1]);
            usort($burn, fn ($a, $b) => $b[1] <=> $a[1]);

            return [
                'totalCoins' => $totalCoins,
                'mint' => $mint,
                'mintTotal' => $mintTotal,
                'burn' => $burn,
                'burnTotal' => $burnTotal,
                'net' => $mintTotal - $burnTotal, // == bugünkü toplam coin değişimi (düne göre)
            ];
        });

        $n = fn ($v) => number_format($v, 0, ',', '.');
        $lines = fn (array $items) => new HtmlString(
            $items
                ? implode('<br>', array_map(fn ($d) => e($d[0]).': '.$n($d[1]), $items))
                : 'henüz yok'
        );

        $net = $data['net'];
        // Sezgisel renk (kullanıcı direktifi): artı=yeşil, eksi=kırmızı; dağıtım=yeşil, yakım=kırmızı.
        $positive = $net >= 0;
        $netStr = ($net > 0 ? '+' : '').$n($net);

        return [
            Stat::make('Sitedeki Toplam Coin', $n($data['totalCoins']))
                ->description($netStr.' bugün (düne göre)')
                ->descriptionIcon($positive ? 'heroicon-m-arrow-trending-up' : 'heroicon-m-arrow-trending-down')
                ->color($positive ? 'success' : 'danger'),
            Stat::make('Bugün Dağıtılan Coin', $n($data['mintTotal']))
                ->description($lines($data['mint']))
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('success'),
            Stat::make('Bugün Yakılan Coin', $n($data['burnTotal']))
                ->description($lines($data['burn']))
                ->descriptionIcon('heroicon-m-fire')
                ->color('danger'),
            Stat::make('Coin Akışı (bugün net)', $netStr)
                ->description('üretilen '.$n($data['mintTotal']).' · yakılan '.$n($data['burnTotal']))
                ->descriptionIcon($positive ? 'heroicon-m-arrow-trending-up' : 'heroicon-m-arrow-trending-down')
                ->color($positive ? 'success' : 'danger'),
        ];
    }
}
