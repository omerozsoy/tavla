<?php

namespace App\Services;

use App\Models\MatchResult;
use App\Models\User;
use App\Support\StatsConfig;
use Illuminate\Support\Facades\Cache;

/**
 * Profil performans istatistiklerini birlestirir (tek endpoint):
 *   - median_error_rate: kategori bazli medyan PR + sample_count (cache'li)
 *   - wxp: toplam WXP (cached total) + G/M (galibiyet/maglubiyet) + win_rate
 *
 * WXP ve Median birbirinden BAGIMSIZ kaynaklara dayanir:
 *   WXP  -> user_wxp_transactions ledger (cached users.total_wxp)
 *   Median -> match_results.pr
 */
class PlayerStatisticsService
{
    public function __construct(
        private readonly MedianPerformanceService $median,
    ) {}

    /** @return array{median_error_rate: array, wxp: array} */
    public function performanceStats(User $user, string $period): array
    {
        if (! StatsConfig::isValidFilter($period)) {
            $period = 'all';
        }

        return [
            'median_error_rate' => [
                'filter' => $period,
                'categories' => $this->medianCached($user->id, $period),
            ],
            'wxp' => $this->wxpBlock($user),
        ];
    }

    /** Median kategori sonucu — profil sik acildigi icin cache'li (database store). */
    private function medianCached(int $userId, string $period): array
    {
        return Cache::remember(
            self::medianCacheKey($userId, $period),
            now()->addHours(6),
            fn () => $this->median->categoriesFor($userId, $period),
        );
    }

    /**
     * WXP + G/M + win rate.
     * G/M source of truth = match_results (tum tamamlanmis maclar; won boolean).
     * users.wins/losses yalniz RANKED sayar; WXP/G/M rating'den bagimsiz oldugu icin
     * casual dahil tum tamamlanmis maclari sayariz. Iki hafif indexli COUNT.
     */
    private function wxpBlock(User $user): array
    {
        $wins = (int) MatchResult::where('user_id', $user->id)->where('won', true)->count();
        $losses = (int) MatchResult::where('user_id', $user->id)->where('won', false)->count();
        $total = $wins + $losses;
        $winRate = $total > 0 ? round($wins / $total * 100, 2) : 0.0;

        return [
            'total' => (int) ($user->total_wxp ?? 0),
            'wins' => $wins,
            'losses' => $losses,
            'total_matches' => $total,
            'win_rate' => $winRate,
        ];
    }

    /** Yeni mac/PR sonrasi ilgili kullanicinin TUM filtre cache'lerini temizle. */
    public function invalidate(int $userId): void
    {
        foreach (array_keys(StatsConfig::DATE_FILTERS) as $filter) {
            Cache::forget(self::medianCacheKey($userId, $filter));
        }
    }

    private static function medianCacheKey(int $userId, string $period): string
    {
        return "player:{$userId}:median-pr:{$period}";
    }
}
