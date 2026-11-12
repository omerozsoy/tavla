<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserStat;
use App\Support\MatchBackstop;
use App\Support\UserProfileReset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * UserProfileReset — profil "temiz başlangıç": kendi maç/PR/istatistik/başarım sıfırlanır,
 * rating başlangıca döner; hesap + jetonlar KORUNUR, RAKİBİN kaydına DOKUNULMAZ.
 */
class UserProfileResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_wipes_own_matches_and_stats_but_keeps_account_and_coins(): void
    {
        // starting_rating ayarı yok -> Setting::int varsayılanı 1400 devreye girer.
        $u = User::factory()->create(['rating' => 1850, 'wins' => 10, 'losses' => 3, 'games_played' => 13, 'coins' => 500]);
        $opp = User::factory()->create(['rating' => 1600]);

        MatchResult::create(['user_id' => $u->id, 'opponent_user_id' => $opp->id, 'won' => true, 'opponent_rating' => 1600, 'rating_before' => 1840, 'rating_after' => 1850, 'delta' => 10, 'room_code' => 'ABC12']);
        MatchResult::create(['user_id' => $opp->id, 'opponent_user_id' => $u->id, 'won' => false, 'opponent_rating' => 1840, 'rating_before' => 1610, 'rating_after' => 1600, 'delta' => -10, 'room_code' => 'ABC12']);
        UserStat::forUser($u->id)->forceFill(['best_rating' => 1850, 'best_win_streak' => 5])->save();

        UserProfileReset::reset($u);

        $u->refresh();
        // Rating başlangıca döndü, sayaçlar sıfır, kariyer PR temiz.
        $this->assertSame(1400, (int) $u->rating);
        $this->assertSame(0, (int) $u->wins);
        $this->assertSame(0, (int) $u->losses);
        $this->assertSame(0, (int) $u->games_played);
        $this->assertNull($u->career_pr);
        // Hesap + jetonlar KORUNDU.
        $this->assertDatabaseHas('users', ['id' => $u->id, 'coins' => 500]);
        // Kendi maçları + istatistik satırı gitti.
        $this->assertDatabaseMissing('match_results', ['user_id' => $u->id]);
        $this->assertDatabaseMissing('user_stats', ['user_id' => $u->id]);
        // RAKİBİN maç kaydı DURUYOR (sıfırlama rakibi etkilemez).
        $this->assertDatabaseHas('match_results', ['user_id' => $opp->id, 'room_code' => 'ABC12']);
    }

    // KÖK NEDEN: reset match_results'u siler ama son 2 günün bitmiş online odaları kalır -> sweep
    // (matches:backstop-finished) eksik satırı GERİ YAZARDI, eski maçlar clean-slate'te yeniden belirir.
    public function test_reset_blocks_backstop_from_regenerating_old_online_matches(): void
    {
        $u = User::factory()->create(['rating' => 1400]);
        $opp = User::factory()->create(['rating' => 1500]);
        $room = Room::create([
            'code' => 'RST01', 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $u->id, 'p2_user_id' => $opp->id, 'p1_name' => 'Me', 'p2_name' => 'Opp',
            'status' => 'finished', 'mode' => 'ranked', 'stake' => 0, 'target' => 1,
            'authoritative' => true, 'version' => 0, 'server_version' => 0,
            'server_match' => ['target' => 1, 'done' => true, 'winner' => 'black',
                'score' => ['white' => 0, 'black' => 1]],
        ]);
        Room::whereKey($room->id)->update(['updated_at' => now()->subMinutes(5)]); // reset'ten ÖNCE bitmiş

        // Reset YOKKEN backstop her iki oyuncuya satır yazar (beklenen davranış).
        $this->assertSame(2, MatchBackstop::ensure($room->fresh()));
        MatchResult::where('user_id', $u->id)->delete(); // $u'yu tekrar "eksik" yap

        UserProfileReset::reset($u->fresh());

        // Reset'ten SONRA aynı eski oda $u'ya satır YAZMAMALI (rakip zaten var, dokunulmaz).
        MatchBackstop::ensure($room->fresh());
        $this->assertDatabaseMissing('match_results', ['user_id' => $u->id, 'room_code' => 'RST01']);
        $this->assertDatabaseHas('match_results', ['user_id' => $opp->id, 'room_code' => 'RST01']);
    }

    public function test_reset_invalidates_stats_caches(): void
    {
        // "Maç Tipine Göre PR" (median/pooled) ve "Zar Ortalamaları" cache'li -> reset temizlemezse
        // veri silinse de bayat cache'ten gösterilir. Cache anahtarlarına değer koy, reset sonrası silinsin.
        $u = User::factory()->create(['rating' => 1850]);
        Cache::put("player:{$u->id}:median-pr2:all", ['stale' => true], 3600);
        Cache::put("player:{$u->id}:dice-stats:v2:all", ['stale' => true], 3600);

        UserProfileReset::reset($u);

        $this->assertNull(Cache::get("player:{$u->id}:median-pr2:all"));
        $this->assertNull(Cache::get("player:{$u->id}:dice-stats:v2:all"));
    }

    public function test_reset_endpoint_requires_auth_and_returns_user(): void
    {
        $this->postJson('/api/account/reset')->assertUnauthorized();

        $u = User::factory()->create(['rating' => 1850]);
        $this->actingAs($u)->postJson('/api/account/reset')
            ->assertOk()
            ->assertJsonPath('user.id', $u->id);
    }
}
