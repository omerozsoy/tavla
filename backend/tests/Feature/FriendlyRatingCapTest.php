<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use App\Support\RatingPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Arkadaş/Kılıç (friendly) maçları PUANLI; aynı rakiple 24h içinde en fazla N kez rating/PR.
 */
class FriendlyRatingCapTest extends TestCase
{
    use RefreshDatabase;

    private function friendlyRoom(User $a, User $b): Room
    {
        return Room::create([
            'code' => 'FR'.$a->id.$b->id,
            'mode' => 'friendly',
            'status' => 'finished',
            'p1_token' => 'tok1'.$a->id, 'p2_token' => 'tok2'.$b->id,
            'p1_user_id' => $a->id, 'p1_name' => 'A', 'p1_rating' => 1500,
            'p2_user_id' => $b->id, 'p2_name' => 'B', 'p2_rating' => 1500,
            'target' => 1,
        ]);
    }

    private function ratedRow(int $userId, int $oppId, string $code, bool $rated = true, ?string $when = null): void
    {
        $m = MatchResult::create([
            'user_id' => $userId, 'won' => true, 'opponent_rating' => 1500,
            'opponent_user_id' => $oppId, 'rated' => $rated,
            'rating_before' => 1500, 'rating_after' => $rated ? 1510 : 1500,
            'delta' => $rated ? 10 : 0, 'room_code' => $code,
        ]);
        if ($when !== null) {
            // created_at'i geçmişe al (query builder -> timestamps'a dokunmaz).
            MatchResult::where('id', $m->id)->update(['created_at' => $when]);
        }
    }

    public function test_bot_unranked_matchmaking_and_tournament_ranked(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $base = ['status' => 'finished', 'p1_name' => 'A', 'p2_name' => 'B', 'p1_token' => 'ta', 'p2_token' => 'tb', 'p1_user_id' => $a->id, 'p2_user_id' => $b->id];
        $ranked = Room::create(['code' => 'RK1', 'mode' => 'ranked'] + $base);
        $this->assertTrue(RatingPolicy::isRanked($ranked, $a->id, $b->id));
        $tourn = Room::create(['code' => 'TR1', 'mode' => null] + $base);
        $this->assertTrue(RatingPolicy::isRanked($tourn, $a->id, $b->id));
        $bot = Room::create(['code' => 'BOT1', 'mode' => 'friendly', 'bot' => true, 'status' => 'finished', 'p1_name' => 'A', 'p1_token' => 'bota', 'p1_user_id' => $a->id]);
        $this->assertFalse(RatingPolicy::isRanked($bot, $a->id, 0));
    }

    public function test_friendly_rated_until_cap_then_casual(): void
    {
        Setting::put('friendly_rating_daily_limit', 3);
        Cache::flush();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $room = $this->friendlyRoom($a, $b);

        for ($i = 0; $i < 3; $i++) {
            $this->assertTrue(RatingPolicy::isRanked($room, $a->id, $b->id), 'match '.($i + 1).' ranked olmalı');
            $this->ratedRow($a->id, $b->id, 'R'.$i); // puanlı maçı simüle et
        }
        // 4. maç -> limit aşımı -> casual
        $this->assertFalse(RatingPolicy::isRanked($room, $a->id, $b->id), '4. maç over-cap olmalı');
    }

    public function test_matches_older_than_24h_do_not_count(): void
    {
        Setting::put('friendly_rating_daily_limit', 3);
        Cache::flush();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $room = $this->friendlyRoom($a, $b);
        for ($i = 0; $i < 3; $i++) {
            $this->ratedRow($a->id, $b->id, 'OLD'.$i, true, now()->subHours(25)->toDateTimeString());
        }
        $this->assertTrue(RatingPolicy::isRanked($room, $a->id, $b->id), '25 saat öncesi sayılmamalı');
    }

    public function test_casual_rows_do_not_count_toward_cap(): void
    {
        Setting::put('friendly_rating_daily_limit', 3);
        Cache::flush();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $room = $this->friendlyRoom($a, $b);
        for ($i = 0; $i < 5; $i++) {
            $this->ratedRow($a->id, $b->id, 'C'.$i, false); // rated=false -> sayılmaz
        }
        $this->assertTrue(RatingPolicy::isRanked($room, $a->id, $b->id));
    }

    public function test_limit_zero_makes_friendly_unrated(): void
    {
        Setting::put('friendly_rating_daily_limit', 0);
        Cache::flush();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $room = $this->friendlyRoom($a, $b);
        $this->assertFalse(RatingPolicy::isRanked($room, $a->id, $b->id));
    }
}
