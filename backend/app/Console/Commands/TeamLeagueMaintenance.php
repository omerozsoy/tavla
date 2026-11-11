<?php

namespace App\Console\Commands;

use App\Support\TeamLeague\TeamSeason;
use App\Support\TeamLeague\TeamService;
use App\Support\TeamLeague\TeamStandings;
use Illuminate\Console\Command;

/**
 * Takımlar Ligi günlük bakımı (§5/§10). İdempotent:
 *  - Premium 7 günlük yenileme süresi süpürmesi (süre geçen üyeyi çıkar, 72s bekleme).
 *  - Kurucu 60 gün inaktifse aktif-Premium en kıdemli yardımcıya otomatik devir.
 *  - BİTEN sezonun ödülleri: düello puanı sıralamasından ilk 3 + şampiyon rozeti/coin + En İyi Düellocu
 *    coin'i. prevKey DAİMA tamamen bitmiş sezonu gösterir (now−3ay). Idempotent → her gün güvenle.
 */
class TeamLeagueMaintenance extends Command
{
    protected $signature = 'teamleague:maintenance';

    protected $description = 'Takımlar Ligi: Premium süresi + kurucu inaktiflik devri + sezon ödül dağıtımı';

    public function handle(): int
    {
        $svc = app(TeamService::class);
        $this->safe(fn () => $svc->premiumGraceSweep());
        $this->safe(fn () => $svc->founderInactivitySweep());

        // BİTEN (önceki) sezonun şampiyon kaydı + ödülleri (düello puanı). Idempotent (firstOrCreate +
        // wallet idempotency_key) → coin yalnız bir kez verilir.
        $this->safe(fn () => app(TeamStandings::class)->distributeSeasonAwards(TeamSeason::prevKey()));

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
