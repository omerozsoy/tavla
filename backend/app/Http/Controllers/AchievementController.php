<?php

namespace App\Http\Controllers;

use App\Models\UserAchievement;
use App\Services\Achievements\AchievementCatalog;
use App\Services\Achievements\AchievementService;
use Illuminate\Http\Request;

/**
 * Basarim (achievement) API'si — giris gerektirir.
 *  GET  /me/achievements        tam katalog + progress + rarity orani + featured
 *  POST /me/achievements/featured   sergilenen (max 3) rozetleri kaydet
 *  GET  /me/achievements/unseen     henuz animasyon gosterilmemis unlock'lar (+ seen isaretler)
 */
class AchievementController extends Controller
{
    public function __construct(private AchievementService $svc) {}

    public function index(Request $request)
    {
        return response()->json($this->svc->catalogFor($request->user()));
    }

    /**
     * Halka acik katalog (Bilgi > Rozetler sekmesi / misafir). Kullanici progress'i YOK.
     * Gizli rozetler maskeli ('???') doner — sart aciklanmaz.
     */
    public function publicCatalog()
    {
        $rarity = $this->svc->rarityRatios();
        $totalUsers = max(1, (int) ($rarity['__users'] ?? 1));

        $items = [];
        foreach (AchievementCatalog::all() as $def) {
            $hidden = (bool) ($def['hidden'] ?? false);
            $ratio = (int) ($rarity[$def['slug']] ?? 0) / $totalUsers;
            $items[] = [
                'slug' => $def['slug'],
                'category' => $def['category'],
                'name' => $hidden ? '???' : $def['name'],
                'desc' => $hidden ? '???' : $def['desc'],
                'icon' => $hidden ? 'lock-key' : $def['icon'],
                'tier' => $def['tier'],
                'rarity' => AchievementCatalog::rarityForRatio($ratio),
                'rarityPct' => round($ratio * 100, $ratio < 0.01 ? 2 : 1),
                'rewardCoin' => (int) ($def['reward_coin'] ?? 0),
                'hidden' => $hidden,
            ];
        }
        return response()->json(['total' => count($items), 'items' => $items]);
    }

    /** Sergilenen rozetler: en fazla 3, yalnizca KAZANILMIS slug'lar kabul edilir. */
    public function setFeatured(Request $request)
    {
        $data = $request->validate([
            'slugs' => ['array', 'max:20'], // fazlasi kabul edilir; asagida sahip-olunan ilk 3'e kirpilir
            'slugs.*' => ['string', 'max:48'],
        ]);
        $user = $request->user();

        $requested = array_values(array_unique($data['slugs'] ?? []));
        // Sadece gercekten kazanilmis + katalogda var olan slug'lar.
        $owned = UserAchievement::where('user_id', $user->id)
            ->whereIn('achievement_slug', $requested)->pluck('achievement_slug')->all();
        $clean = array_values(array_filter($requested, fn ($s) => in_array($s, $owned, true) && AchievementCatalog::bySlug($s)));

        $user->featured_badges = array_slice($clean, 0, 3);
        $user->save();

        return response()->json(['featured' => $this->svc->resolveFeatured($user->featured_badges)]);
    }

    /**
     * Gorulmemis unlock'lar (turnuva/backfill/coprus disi kanallardan gelenler dahil).
     * Doner ve ayni cagride notified=true isaretler -> animasyon bir kez gosterilir.
     */
    public function unseen(Request $request)
    {
        $user = $request->user();
        $rows = UserAchievement::where('user_id', $user->id)
            ->where('notified', false)->orderBy('unlocked_at')->get();

        $items = [];
        foreach ($rows as $ua) {
            $def = AchievementCatalog::bySlug($ua->achievement_slug);
            if (! $def) {
                continue;
            }
            $items[] = [
                'slug' => $def['slug'], 'name' => $def['name'], 'desc' => $def['desc'],
                'icon' => $def['icon'], 'tier' => $def['tier'], 'rarity' => $def['rarity'],
                'rewardCoin' => (int) $ua->reward_coin,
            ];
        }

        if ($rows->isNotEmpty()) {
            UserAchievement::where('user_id', $user->id)->where('notified', false)->update(['notified' => true]);
        }

        return response()->json(['items' => $items]);
    }
}
