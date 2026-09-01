<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use App\Models\UserAchievement;
use App\Models\UserStat;
use App\Services\Achievements\AchievementService;
use App\Services\Achievements\MatchContext;
use App\Services\Achievements\StatsUpdater;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Basarim (achievement) motoru — uctan uca: threshold/event unlock, idempotency,
 * coin odul tekrarsizligi, settle entegrasyonu, featured API, katalog API, backfill.
 */
class AchievementTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick = 'p1', array $attrs = []): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        // wins/games_played/coins/rating fillable DEGIL -> forceFill (gercek akista da dogrudan atanir).
        if ($attrs) {
            $u->forceFill($attrs)->save();
        }
        return $u;
    }

    private function mr(User $u, bool $won, ?int $length = 7, int $daysAgo = 0): MatchResult
    {
        $mr = MatchResult::create([
            'user_id' => $u->id, 'won' => $won,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => $won ? 1516 : 1484,
            'delta' => $won ? 16 : -16, 'match_length' => $length, 'match_type' => 'match',
        ]);
        if ($daysAgo > 0) {
            $mr->created_at = now()->subDays($daysAgo);
            $mr->saveQuietly();
        }
        return $mr;
    }

    // ==================== THRESHOLD ====================
    public function test_threshold_unlock_and_idempotent(): void
    {
        $u = $this->makeUser('t', ['wins' => 100, 'losses' => 5, 'games_played' => 105]);
        $svc = app(AchievementService::class);

        $new = $svc->evaluate($u);
        $slugs = array_column($new, 'slug');

        // 100 galibiyet -> wins_1(1),wins_2(10),wins_3(50),wins_4(100)
        $this->assertContains('wins_1', $slugs);
        $this->assertContains('wins_4', $slugs);
        // 105 mac -> match_1(10),match_2(50),match_3(100) ; match_4(500) HAYIR
        $this->assertContains('match_3', $slugs);
        $this->assertNotContains('match_4', $slugs);

        $countAfterFirst = UserAchievement::where('user_id', $u->id)->count();
        // Ikinci degerlendirme -> yeni unlock YOK (idempotent)
        $this->assertCount(0, $svc->evaluate($u->fresh()));
        $this->assertSame($countAfterFirst, UserAchievement::where('user_id', $u->id)->count());
    }

    public function test_coin_reward_awarded_once(): void
    {
        $u = $this->makeUser('c', ['coins' => 1000]);
        $svc = app(AchievementService::class);

        $svc->evaluate($u); // coin_1 (1000) -> +100 coin
        $u->refresh();
        $this->assertSame(1100, (int) $u->coins);
        $this->assertSame(1, UserAchievement::where('user_id', $u->id)->where('achievement_slug', 'coin_1')->count());

        // Tekrar: coin_1 sahipli, coin_2 (5000) henuz degil -> coin degismez
        $svc->evaluate($u->fresh());
        $this->assertSame(1100, (int) $u->fresh()->coins);
    }

    // ==================== EVENT ====================
    public function test_event_unlock_via_context(): void
    {
        $u = $this->makeUser('e');
        $ctx = (new MatchContext())->set('flag_first_66')->set('flag_win_high_luck');

        $new = app(AchievementService::class)->evaluate($u, $ctx);
        $slugs = array_column($new, 'slug');
        $this->assertContains('dice_first_66', $slugs);
        $this->assertContains('dice_win_high_luck', $slugs);
        // Bayragi olmayan event acilmamali
        $this->assertNotContains('dice_first_22', $slugs);
    }

    public function test_unlock_is_idempotent_at_db_level(): void
    {
        $u = $this->makeUser('i');
        $def = ['slug' => 'wins_1', 'name' => 'x', 'desc' => 'x', 'icon' => 'trophy', 'tier' => 'bronze', 'reward_coin' => 100];
        $svc = app(AchievementService::class);
        $this->assertTrue($svc->unlock($u, $def));
        $this->assertFalse($svc->unlock($u, $def)); // ikinci kez -> false
        $this->assertSame(1, UserAchievement::where('user_id', $u->id)->where('achievement_slug', 'wins_1')->count());
    }

    // ==================== SETTLE ENTEGRASYONU ====================
    public function test_report_rating_unlocks_and_returns_achievements(): void
    {
        $u = $this->makeUser('s');
        Sanctum::actingAs($u);

        $res = $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'match_length' => 7, 'ranked' => true,
        ]);
        $res->assertOk();
        $slugs = array_column($res->json('achievements'), 'slug');
        // Ilk galibiyet + ilk rutbe yukselisi (delta>0)
        $this->assertContains('wins_1', $slugs);
        $this->assertContains('rating_firstup', $slugs);

        $this->assertSame(1, (int) $u->fresh()->wins);
        $this->assertTrue(UserAchievement::where('user_id', $u->id)->where('achievement_slug', 'wins_1')->exists());
        // Sayac satiri kuruldu (seri = 1)
        $this->assertSame(1, (int) UserStat::forUser($u->id)->best_win_streak);
    }

    // ==================== FEATURED ====================
    public function test_featured_accepts_only_owned_max_three(): void
    {
        $u = $this->makeUser('f');
        foreach (['wins_1', 'wins_2', 'match_1', 'coin_1'] as $s) {
            UserAchievement::create(['user_id' => $u->id, 'achievement_slug' => $s, 'unlocked_at' => now()]);
        }
        Sanctum::actingAs($u);

        // 4 istenen + 1 sahip-olmayan -> yalniz sahip olunanlardan ilk 3
        $res = $this->postJson('/api/me/achievements/featured', [
            'slugs' => ['wins_1', 'wins_2', 'match_1', 'coin_1', 'hidden_42'],
        ]);
        $res->assertOk();
        $feat = $res->json('featured');
        $this->assertCount(3, $feat);
        $this->assertNotContains('hidden_42', array_column($feat, 'slug'));
        $this->assertCount(3, $u->fresh()->featured_badges);
    }

    // ==================== KATALOG API ====================
    public function test_catalog_api_shape(): void
    {
        $u = $this->makeUser('k', ['wins' => 50, 'games_played' => 50]);
        app(AchievementService::class)->evaluate($u);
        Sanctum::actingAs($u->fresh());

        $res = $this->getJson('/api/me/achievements');
        $res->assertOk()
            ->assertJsonPath('total', count(config('achievements.list')))
            ->assertJsonStructure(['total', 'unlockedCount', 'featured', 'items' => [['slug', 'name', 'unlocked', 'progress', 'target', 'progressPct', 'rarity', 'rarityPct']]]);
        $this->assertGreaterThanOrEqual(100, $res->json('total'));
        // wins_4 (100) henuz kilitli ama progress 50/100
        $item = collect($res->json('items'))->firstWhere('slug', 'wins_4');
        $this->assertFalse($item['unlocked']);
        $this->assertSame(50, $item['progress']);
        $this->assertSame(100, $item['target']);
        $this->assertSame(50, $item['progressPct']);
    }

    // ==================== BACKFILL ====================
    public function test_backfill_grants_silently_and_idempotent(): void
    {
        // 10 galibiyetli gecmis (users sayaclari + match_results)
        $u = $this->makeUser('b', ['wins' => 10, 'games_played' => 10, 'coins' => 500]);
        for ($i = 0; $i < 10; $i++) {
            $this->mr($u, true, 7, 30 - $i); // kronolojik
        }

        $this->artisan('achievements:backfill')->assertSuccessful();

        $owned = UserAchievement::where('user_id', $u->id)->pluck('achievement_slug')->all();
        $this->assertContains('wins_2', $owned);   // 10 galibiyet
        $this->assertContains('match_1', $owned);  // 10 mac
        $this->assertContains('streak_3', $owned); // 10 galibiyet serisi (replay)

        // Sessiz + odulsuz: coin degismedi, notified=true
        $this->assertSame(500, (int) $u->fresh()->coins);
        $this->assertSame(0, UserAchievement::where('user_id', $u->id)->where('reward_coin', '>', 0)->count());
        $this->assertSame(0, UserAchievement::where('user_id', $u->id)->where('notified', false)->count());

        $before = UserAchievement::where('user_id', $u->id)->count();
        $this->artisan('achievements:backfill')->assertSuccessful(); // idempotent
        $this->assertSame($before, UserAchievement::where('user_id', $u->id)->count());
    }

    public function test_backfill_dry_run_writes_nothing(): void
    {
        $u = $this->makeUser('d', ['wins' => 10, 'games_played' => 10]);
        $this->mr($u, true, 7);
        $this->artisan('achievements:backfill --dry-run')->assertSuccessful();
        $this->assertSame(0, UserAchievement::where('user_id', $u->id)->count());
    }

    // ==================== STREAK SAYAci ====================
    public function test_streak_counter_via_stats_updater(): void
    {
        $u = $this->makeUser('st');
        $updater = app(StatsUpdater::class);
        // W W W L W W  -> best streak 3
        foreach ([true, true, true, false, true, true] as $won) {
            $updater->updateForMatch($u->fresh(), $this->mr($u, $won));
        }
        $this->assertSame(3, (int) UserStat::forUser($u->id)->best_win_streak);
        $this->assertSame(2, (int) UserStat::forUser($u->id)->current_win_streak);
    }

    // ==================== MAÇ SİNYALLERİ (payload) ====================
    public function test_match_signals_gammon_winprob_and_board_flags(): void
    {
        $u = $this->makeUser('sig');
        $mr = MatchResult::create([
            'user_id' => $u->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 7, 'match_type' => 'match', 'luck' => 0,
        ]);
        $ctx = app(StatsUpdater::class)->updateForMatch($u->fresh(), $mr, [
            'gammons' => 1, 'backgammons' => 1, 'min_win_prob' => 1.5,
            'flags' => ['prime6', 'closeout'],
        ]);

        $stat = UserStat::forUser($u->id);
        $this->assertSame(1, (int) $stat->total_gammons);
        $this->assertSame(1, (int) $stat->total_backgammons);
        $this->assertTrue($ctx->has('flag_backgammon_win'));
        $this->assertTrue($ctx->has('flag_prime6'));
        $this->assertTrue($ctx->has('flag_closeout'));
        // min WP 1.5 (kazandi) -> anka + improbable + howcome + comeback
        $this->assertTrue($ctx->has('flag_anka'));
        $this->assertTrue($ctx->has('flag_improbable'));
        $this->assertTrue($ctx->has('flag_comeback'));

        $slugs = array_column(app(AchievementService::class)->evaluate($u->fresh(), $ctx), 'slug');
        $this->assertContains('gammon_1', $slugs);       // İlk mars
        $this->assertContains('backgammon_1', $slugs);   // İlk katmerli mars
        $this->assertContains('tavla_katmerli_win', $slugs);
        $this->assertContains('tavla_prime6', $slugs);
        $this->assertContains('tavla_closeout', $slugs);
        $this->assertContains('tavla_comeback', $slugs);
        $this->assertContains('hidden_anka', $slugs);
    }
}
