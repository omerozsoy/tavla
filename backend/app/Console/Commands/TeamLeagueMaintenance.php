<?php

namespace App\Console\Commands;

use App\Models\TeamMatch;
use App\Support\TeamLeague\TeamService;
use App\Support\TeamLeague\TeamStandings;
use Illuminate\Console\Command;

/**
 * Takımlar Ligi günlük bakımı (§5/§10). İdempotent:
 *  - Premium 7 günlük yenileme süresi süpürmesi (süre geçen üyeyi çıkar, 72s bekleme).
 *  - Kurucu 60 gün inaktifse aktif-Premium en kıdemli yardımcıya otomatik devir.
 *  - Geçen ayın ödülleri: o aya ait bekleyen karşılaşma kalmadıysa kalıcı kupa/rozet dağıt (mükerrer yok).
 */
class TeamLeagueMaintenance extends Command
{
    protected $signature = 'teamleague:maintenance';

    protected $description = 'Takımlar Ligi: Premium süresi + kurucu inaktiflik devri + aylık ödül dağıtımı';

    public function handle(): int
    {
        $svc = app(TeamService::class);
        $this->safe(fn () => $svc->premiumGraceSweep());
        $this->safe(fn () => $svc->founderInactivitySweep());

        // Geçen ay: o aya ait süren karşılaşma kalmadıysa ödülleri kesinleştir (§10 "sonuçlanınca").
        $prev = now()->subMonthNoOverflow()->format('Y-m');
        $pending = TeamMatch::where('month_key', $prev)->whereIn('status', ['proposed', 'scheduled', 'live'])->exists();
        if (! $pending) {
            $this->safe(fn () => app(TeamStandings::class)->distributeMonthlyAwards($prev));
        }

        return self::SUCCESS;
    }

    private function safe(callable $fn): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
