<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// tavla:backfill-rating-reason — gecmis puansiz satirlara rating_reason doldurur. Oda varsa KESIN
// (RatingPolicy), yoksa satir alanlarindan turetir. Puanli satir dokunulmaz (NULL kalir).
class BackfillRatingReasonTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'first_name' => 'B', 'last_name' => 'R', 'country' => '',
            'nickname' => 'br'.uniqid(), 'email' => uniqid().'@x.com',
            'password' => bcrypt('secret123'), 'rating' => 1500,
        ]);
    }

    private function row(string $code, array $extra = []): MatchResult
    {
        return MatchResult::create(array_merge([
            'user_id' => $this->user()->id, 'room_code' => $code, 'won' => false, 'rated' => false,
            'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'opponent_rating' => 1500, 'opponent_name' => 'opp', 'match_length' => 5, 'match_type' => 'match',
            'opponent_user_id' => 999,
        ], $extra));
    }

    public function test_backfill_fills_reasons_and_leaves_rated_null(): void
    {
        // 1) oda VAR + friendly -> 'friendly' (kesin)
        Room::create(['code' => 'FRND1', 'p1_token' => 't', 'p1_name' => 'A', 'status' => 'finished', 'mode' => 'friendly', 'version' => 0]);
        $friendly = $this->row('FRND1');

        // 2) oda YOK + match_type ai -> 'bot'
        $bot = $this->row('GONE1', ['match_type' => 'ai']);

        // 3) oda YOK + rakip hesapsiz -> 'guest'
        $guest = $this->row('GONE2', ['opponent_user_id' => null]);

        // 4) oda YOK + insan rakip -> 'friendly' (turetim)
        $human = $this->row('GONE3');

        // 5) PUANLI satir -> dokunulmaz (NULL kalir)
        $rated = $this->row('RTD01', ['rated' => true]);

        $this->artisan('tavla:backfill-rating-reason')->assertSuccessful();

        $this->assertSame('friendly', $friendly->fresh()->rating_reason);
        $this->assertSame('bot', $bot->fresh()->rating_reason);
        $this->assertSame('guest', $guest->fresh()->rating_reason);
        $this->assertSame('friendly', $human->fresh()->rating_reason);
        $this->assertNull($rated->fresh()->rating_reason, 'puanli satir dokunulmamali');
    }

    public function test_dry_run_changes_nothing(): void
    {
        $r = $this->row('DRY01', ['match_type' => 'ai']);
        $this->artisan('tavla:backfill-rating-reason --dry-run')->assertSuccessful();
        $this->assertNull($r->fresh()->rating_reason, 'dry-run yazmamali');
    }
}
