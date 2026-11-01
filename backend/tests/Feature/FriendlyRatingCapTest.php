<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Support\RatingPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * RatingPolicy::isRanked — 2026-11-01 sonrası: arkadaş/kılıç (mode='friendly') HER ZAMAN puansız.
 * Eski aynı-rakip 24h limiti KALDIRILDI. Puanlı yalnız eşleşme (ranked) + turnuva (mode=NULL).
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

    // Misafir (hesapsız) rakip: her modda PUANSIZ.
    public function test_guest_opponent_is_unranked(): void
    {
        $a = User::factory()->create();
        $room = Room::create([
            'code' => 'GST1', 'mode' => 'ranked', 'status' => 'finished',
            'p1_token' => 'tga', 'p1_user_id' => $a->id, 'p1_name' => 'A', 'p1_rating' => 1500,
            'p2_token' => 'tgb', 'p2_user_id' => null, 'p2_name' => 'Misafir', 'p2_rating' => 4000,
        ]);
        $this->assertFalse(RatingPolicy::isRanked($room, $a->id, 0));
        $this->assertFalse(RatingPolicy::isRanked($room, 0, $a->id));
    }

    // YENİ KURAL: arkadaş/kılıç maçı HER ZAMAN puansız — kaç kez oynanırsa oynansın (limit YOK).
    public function test_friendly_always_unrated(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $room = $this->friendlyRoom($a, $b);
        for ($i = 0; $i < 10; $i++) {
            $this->assertFalse(RatingPolicy::isRanked($room, $a->id, $b->id), 'friendly her zaman puansız (maç '.($i + 1).')');
        }
    }

    // Puansız (unrated) oda bayrağı: her modda puansız.
    public function test_unrated_room_flag_unranked(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $room = Room::create([
            'code' => 'UNR1', 'mode' => 'ranked', 'unrated' => true, 'status' => 'finished',
            'p1_token' => 'tua', 'p1_user_id' => $a->id, 'p1_name' => 'A', 'p1_rating' => 1500,
            'p2_token' => 'tub', 'p2_user_id' => $b->id, 'p2_name' => 'B', 'p2_rating' => 1500,
        ]);
        $this->assertFalse(RatingPolicy::isRanked($room, $a->id, $b->id));
    }
}
