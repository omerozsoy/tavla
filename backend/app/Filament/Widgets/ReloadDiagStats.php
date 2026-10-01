<?php

namespace App\Filament\Widgets;

use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * RELOAD TEŞHİS (GEÇİCİ): Safari "sayfa çok yenileniyor" şikâyetinin kökünü canlı ayırır.
 * reload_diags tablosu (reloadDiag.ts beacon'ları) son 24 saat için özetlenir:
 *   - Durum 1 = autoUpdate (deploy sonrası) -> banner ile çözüldü; bu düşmeli.
 *   - Durum 2 = Safari'nin bellek dolu sekmeyi öldürüp kendiliğinden (native) reload etmesi;
 *               özellikle oyun ekranında (WASM sinir ağı) = prev_view=game.
 * Ölçüm bitince bu widget + tablo + route + reloadDiag.ts silinecek.
 */
class ReloadDiagStats extends BaseWidget
{
    protected static ?int $sort = -4;

    protected static ?string $pollingInterval = '30s';

    protected function getStats(): array
    {
        if (! Schema::hasTable('reload_diags')) {
            return [Stat::make('Reload Teşhis', 'Tablo yok')->description('Henüz deploy edilmedi')];
        }

        $since = now()->subDay();
        $base = fn () => DB::table('reload_diags')->where('created_at', '>=', $since);

        $total = (int) $base()->count();
        $autoupdate = (int) $base()->where('cause', 'autoupdate')->count();
        $native = (int) $base()->where('cause', 'native')->count();
        $nativeGame = (int) $base()->where('cause', 'native')->where('prev_view', 'game')->count();
        // iOS/macOS Safari UA: "Safari" içerir ama Chrome/CriOS/Android İÇERMEZ.
        $nativeSafari = (int) $base()->where('cause', 'native')
            ->where('ua', 'like', '%Safari%')
            ->where('ua', 'not like', '%Chrome%')
            ->where('ua', 'not like', '%CriOS%')
            ->where('ua', 'not like', '%Android%')
            ->count();

        $pct = fn (int $n) => $total > 0 ? round(100 * $n / $total) . '%' : '—';
        $fmt = fn (int $n) => number_format($n, 0, ',', '.');

        return [
            Stat::make('Son 24s Toplam Yenilenme', $fmt($total))
                ->description('Yalnız GERÇEK yenilenmeler (ilk ziyaret/gezinme sayılmaz)')
                ->descriptionIcon('heroicon-m-arrow-path')
                ->color($total === 0 ? 'gray' : 'primary'),
            Stat::make('Durum 1 · autoUpdate (deploy)', $fmt($autoupdate) . '  (' . $pct($autoupdate) . ')')
                ->description('Banner ile çözüldü -> zamanla düşmeli')
                ->descriptionIcon('heroicon-m-sparkles')
                ->color($autoupdate === 0 ? 'success' : 'warning'),
            Stat::make('Durum 2 · Safari kendiliğinden', $fmt($nativeSafari) . '  (' . $pct($nativeSafari) . ')')
                ->description('native reload + Safari UA = bellek-öldürme adayı')
                ->descriptionIcon('heroicon-m-exclamation-triangle')
                ->color($nativeSafari === 0 ? 'success' : 'danger'),
            Stat::make('Durum 2 · Oyun ekranında', $fmt($nativeGame))
                ->description('native + oyundayken (WASM) = Safari maç-ortası öldürme; toplam native: ' . $fmt($native))
                ->descriptionIcon('heroicon-m-cpu-chip')
                ->color($nativeGame === 0 ? 'success' : 'danger'),
        ];
    }
}
