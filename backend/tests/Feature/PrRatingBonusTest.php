<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use App\Support\PrRatingBonus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PR ×2 ÖDÜLÜ: online puanlı maçta HEM kazanan HEM PR'ı rakipten DÜŞÜK (daha iyi) oyuncu kazancının
 * bir katını daha alır (toplam ×2). Kaybeden değişmez. Idempotent (bir kez verilir).
 */
class PrRatingBonusTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick, int $rating): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(['rating' => $rating])->save();

        return $u;
    }

    /** İki-satırlı online oda: kazanan (delta>0) + kaybeden, verilen gnubg_pr'larla. */
    private function room(string $code, User $w, User $l, int $delta, ?float $winnerPr, ?float $loserPr): array
    {
        $rowW = MatchResult::create([
            'user_id' => $w->id, 'won' => true, 'rated' => true, 'room_code' => $code,
            'opponent_rating' => $l->rating, 'opponent_user_id' => $l->id,
            'rating_before' => $w->rating - $delta, 'rating_after' => $w->rating, 'delta' => $delta,
            'match_length' => 3, 'coins_after' => 0,
        ]);
        $rowL = MatchResult::create([
            'user_id' => $l->id, 'won' => false, 'rated' => true, 'room_code' => $code,
            'opponent_rating' => $w->rating, 'opponent_user_id' => $w->id,
            'rating_before' => $l->rating + $delta, 'rating_after' => $l->rating, 'delta' => -$delta,
            'match_length' => 3, 'coins_after' => 0,
        ]);
        MatchResult::where('id', $rowW->id)->update(['gnubg_pr' => $winnerPr]);
        MatchResult::where('id', $rowL->id)->update(['gnubg_pr' => $loserPr]);

        return [$rowW->id, $rowL->id];
    }

    public function test_winner_with_better_pr_gets_double_rating(): void
    {
        $w = $this->user('win', 1520);  // maç sonrası (az önce +20 almış)
        $l = $this->user('lose', 1480);
        [$wid, $lid] = $this->room('PB1', $w, $l, 20, winnerPr: 4.0, loserPr: 9.0);

        PrRatingBonus::apply('PB1');

        // Kazanan: +20 bonus -> rating 1540, satır rating_after/delta ×2, pr_rating_bonus=20.
        $this->assertSame(1540, (int) $w->fresh()->rating);
        $rowW = MatchResult::find($wid);
        $this->assertSame(20, (int) $rowW->pr_rating_bonus);
        $this->assertSame(1540, (int) $rowW->rating_after);
        $this->assertSame(40, (int) $rowW->delta);
        // Kaybeden DEĞİŞMEZ (ödül, sıfır-toplam değil).
        $this->assertSame(1480, (int) $l->fresh()->rating);
        $this->assertNull(MatchResult::find($lid)->pr_rating_bonus);
    }

    public function test_worse_or_equal_pr_gets_no_bonus(): void
    {
        $w = $this->user('win', 1520);
        $l = $this->user('lose', 1480);
        $this->room('PB2', $w, $l, 20, winnerPr: 9.0, loserPr: 4.0); // kazanan PR'ı KÖTÜ

        PrRatingBonus::apply('PB2');

        $this->assertSame(1520, (int) $w->fresh()->rating); // bonus yok
        $this->assertSame(0, (int) MatchResult::where('room_code', 'PB2')->where('won', true)->first()->pr_rating_bonus);
    }

    public function test_idempotent_no_double_credit(): void
    {
        $w = $this->user('win', 1520);
        $l = $this->user('lose', 1480);
        $this->room('PB3', $w, $l, 20, winnerPr: 4.0, loserPr: 9.0);

        PrRatingBonus::apply('PB3');
        PrRatingBonus::apply('PB3'); // tekrar (heal/backfill) -> ikinci kez vermez

        $this->assertSame(1540, (int) $w->fresh()->rating); // 1520 + 20, iki değil
    }

    public function test_waits_until_both_pr_known(): void
    {
        $w = $this->user('win', 1520);
        $l = $this->user('lose', 1480);
        $this->room('PB4', $w, $l, 20, winnerPr: 4.0, loserPr: null); // rakip PR'ı henüz yok

        PrRatingBonus::apply('PB4');

        $this->assertSame(1520, (int) $w->fresh()->rating); // beklemede -> dokunulmadı
        $this->assertNull(MatchResult::where('room_code', 'PB4')->where('won', true)->first()->pr_rating_bonus);
    }
}
