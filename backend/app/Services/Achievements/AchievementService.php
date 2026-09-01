<?php

namespace App\Services\Achievements;

use App\Models\Notification;
use App\Models\User;
use App\Models\UserAchievement;
use App\Models\UserStat;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * AchievementService — data-driven basarim motoru.
 *
 * evaluate(): mevcut sayaclar + (varsa) bu macin event bayraklariyla hak kazanilan
 * TUM rozetleri acar. Her rozet unique(user_id,slug) ile idempotent; coin odulu tek kez.
 * Motor gecmisi yeniden taramaz — yalnizca sayac degerlerini esikle karsilastirir.
 */
class AchievementService
{
    /**
     * Kullanici icin degerlendir. $ctx null ise yalnizca threshold (sayac) rozetleri.
     * @return array<int,array> yeni acilan rozet tanimlari (bildirim/animasyon icin)
     */
    public function evaluate(User $user, ?MatchContext $ctx = null, bool $silent = false, bool $award = true): array
    {
        $stat = $user->stat ?: UserStat::forUser($user->id);
        $owned = UserAchievement::where('user_id', $user->id)->pluck('achievement_slug')->flip();
        $unlocked = [];

        foreach (AchievementCatalog::all() as $def) {
            if (isset($owned[$def['slug']])) {
                continue;
            }
            $qualifies = false;
            $progress = 0;

            if (($def['type'] ?? 'threshold') === 'event') {
                $qualifies = $ctx !== null && $ctx->has($def['metric']);
                $progress = $qualifies ? 1 : 0;
            } else {
                $val = MetricResolver::value($user, $stat, $def['metric']);
                $progress = (int) $val;
                $qualifies = $val >= $def['value'];
            }

            if ($qualifies && $this->unlock($user, $def, $progress, $silent, $award)) {
                $unlocked[] = $def;
            }
        }

        return $unlocked;
    }

    /**
     * Tek bir rozeti (idempotent) ac: kayit + coin odulu + bildirim.
     * @return bool gercekten YENI acildi mi
     */
    public function unlock(User $user, array $def, int $progress = 0, bool $silent = false, bool $award = true): bool
    {
        $coin = $award ? (int) ($def['reward_coin'] ?? 0) : 0;
        try {
            return DB::transaction(function () use ($user, $def, $progress, $silent, $coin) {
                // Yaris kosulunda ikinci deneme unique constraint'e takilir -> catch.
                UserAchievement::create([
                    'user_id' => $user->id,
                    'achievement_slug' => $def['slug'],
                    'unlocked_at' => now(),
                    'progress' => $progress,
                    'reward_coin' => $coin,
                    'notified' => $silent, // backfill: animasyon gosterme (zaten "goruldu")
                ]);

                if ($coin > 0) {
                    // coins fillable degil -> dogrudan artir (mass-assignment degil).
                    $user->increment('coins', $coin);
                }

                if (! $silent) {
                    $body = $coin > 0 ? "+{$coin} coin" : null;
                    Notification::notify($user->id, 'Yeni rozet: '.$def['name'], $body, $def['icon'] ?? 'medal');
                }

                return true;
            });
        } catch (QueryException $e) {
            return false; // zaten var (duplicate) — idempotent
        }
    }

    /**
     * Bir kullanicinin TAM katalogu: unlock durumu + progress + rarity orani.
     * Achievements sayfasi ve Bilgi sekmesi bunu kullanir.
     */
    public function catalogFor(User $user): array
    {
        $stat = $user->stat ?: UserStat::forUser($user->id);
        $owned = UserAchievement::where('user_id', $user->id)->get()->keyBy('achievement_slug');
        $rarity = $this->rarityRatios();
        $totalUsers = max(1, $rarity['__users']);

        $items = [];
        foreach (AchievementCatalog::all() as $def) {
            $ua = $owned->get($def['slug']);
            $isUnlocked = $ua !== null;
            $count = (int) ($rarity[$def['slug']] ?? 0);
            $ratio = $count / $totalUsers;

            [$progress, $target, $pct] = $this->progress($user, $stat, $def, $isUnlocked);

            $items[] = [
                'slug' => $def['slug'],
                'category' => $def['category'],
                'name' => $def['name'],
                'desc' => $def['desc'],
                'icon' => $def['icon'],
                'tier' => $def['tier'],
                'rarity' => AchievementCatalog::rarityForRatio($ratio),
                'rarityPct' => round($ratio * 100, $ratio < 0.01 ? 2 : 1),
                'rewardCoin' => (int) ($def['reward_coin'] ?? 0),
                'hidden' => (bool) ($def['hidden'] ?? false),
                'unlocked' => $isUnlocked,
                'unlockedAt' => $ua ? optional($ua->unlocked_at)->toIso8601String() : null,
                'progress' => $progress,
                'target' => $target,
                'progressPct' => $pct,
            ];
        }

        return [
            'total' => count($items),
            'unlockedCount' => $owned->count(),
            'featured' => array_values($user->featured_badges ?? []),
            'items' => $items,
        ];
    }

    /**
     * Featured slug listesini goruntuleme nesnelerine cevir (kart/rakip detay icin).
     * @return array<int,array{slug:string,name:string,icon:string,tier:?string,rarity:string}>
     */
    public function resolveFeatured(?array $slugs): array
    {
        $out = [];
        foreach (array_slice($slugs ?? [], 0, 3) as $slug) {
            $def = AchievementCatalog::bySlug((string) $slug);
            if ($def) {
                $out[] = [
                    'slug' => $def['slug'], 'name' => $def['name'], 'icon' => $def['icon'],
                    'tier' => $def['tier'], 'rarity' => $def['rarity'],
                ];
            }
        }
        return $out;
    }

    /** Progress hesabi: event -> 0/1; threshold -> min(metric, target). */
    private function progress(User $user, UserStat $stat, array $def, bool $unlocked): array
    {
        if (($def['type'] ?? 'threshold') === 'event') {
            return [$unlocked ? 1 : 0, 1, $unlocked ? 100 : 0];
        }
        $target = (int) $def['value'];
        $cur = (int) MetricResolver::value($user, $stat, $def['metric']);
        $cur = min($cur, $target);
        $pct = $target > 0 ? (int) floor($cur / $target * 100) : 0;
        return [$cur, $target, $unlocked ? 100 : $pct];
    }

    /**
     * slug => kac kullanici kazandi (rarity icin) + toplam kullanici (__users).
     * Tek sorgu, kisa cache.
     */
    public function rarityRatios(): array
    {
        return \Illuminate\Support\Facades\Cache::remember('ach:rarity', 600, function () {
            $counts = UserAchievement::selectRaw('achievement_slug, count(*) c')
                ->groupBy('achievement_slug')->pluck('c', 'achievement_slug')->toArray();
            $counts['__users'] = (int) User::count();
            return $counts;
        });
    }
}
