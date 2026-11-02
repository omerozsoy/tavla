<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeMatchSnowieJob;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\Analysis\GnubgSnowieService;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * TEK PR KAYNAĞI: Snowie otoriter PR'ı yazar. ÇÖP-KALKANI: Snowie overall, mevcut (review) checker/cube'un
 * +2'sini aşarsa (resign/money .mat şişmesi) DOĞRU değeri EZMEZ -> self yazılmaz, opp yazılır.
 */
class AnalyzeMatchSnowieJobTest extends TestCase
{
    use RefreshDatabase;

    private function healthyGnubg(): GnuBgClient
    {
        return new class extends GnuBgClient
        {
            public function analyzeHealthy(): bool
            {
                return true;
            }

            public function analyzeMatch(string $mat, int $plies = 2): ?array
            {
                return ['ok' => true]; // içerik önemsiz; Snowie servisi fake'lendi
            }
        };
    }

    private function fakeSnowie(array $player0, ?array $player1): void
    {
        $this->app->instance(GnubgSnowieService::class, new class($player0, $player1) extends GnubgSnowieService
        {
            public function __construct(private array $p0, private ?array $p1) {}

            public function snowieFromAnalyze(?array $res, int $minCubeDecisions = 1): ?array
            {
                return [$this->p0, $this->p1];
            }
        });
    }

    private function row(string $room, string $hc, array $extra = []): MatchResult
    {
        return MatchResult::create(array_merge([
            'user_id' => User::factory()->create()->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 1, 'match_type' => 'coin', 'room_code' => $room, 'stake' => 100,
            'log' => json_encode(['hc' => $hc, 'log' => [
                ['player' => 'white', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [3, 1], 'playedSteps' => [[8, 5]]],
                ['player' => 'black', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [6, 2], 'playedSteps' => [[24, 18]]],
            ]]),
        ], $extra));
    }

    public function test_inflated_snowie_does_not_overwrite_good_review_values(): void
    {
        // Mevcut (review) DOĞRU: checker 5.0, cube 1.0 -> max 5.0. gnubg_pr 5.2.
        // (gnubg_* kolonları mass-assign dışı -> create değil update ile yaz.)
        $mr = $this->row('GARB1', 'white');
        MatchResult::where('id', $mr->id)->update([
            'gnubg_pr' => 5.2, 'gnubg_checker_pr' => 5.0, 'gnubg_cube_pr' => 1.0, 'pr' => 5.2,
        ]);
        // Snowie ŞİŞMİŞ self (88) + GEÇERLİ opp (4.0).
        $this->fakeSnowie(
            ['pr' => 88.0, 'checker_pr' => 88.0, 'cube_pr' => 0.0, 'cube_equity_lost' => 0, 'cube_decisions' => 0, 'equity_lost' => 8.8, 'decisions' => 50],
            ['pr' => 4.0, 'checker_pr' => 4.0, 'cube_pr' => 0.0, 'cube_equity_lost' => 0, 'cube_decisions' => 0, 'equity_lost' => 0.4, 'decisions' => 50],
        );

        (new AnalyzeMatchSnowieJob($mr->id))->handle($this->healthyGnubg());

        $mr->refresh();
        $this->assertEqualsWithDelta(5.2, (float) $mr->gnubg_pr, 1e-6, 'çöp-kalkanı: şişmiş 88 iyi review 5.2yi EZMEMELİ');
        $this->assertEqualsWithDelta(5.0, (float) $mr->gnubg_checker_pr, 1e-6, 'checker de korunmalı');
        $this->assertEqualsWithDelta(4.0, (float) $mr->gnubg_opponent_pr, 1e-6, 'geçerli opp YAZILMALI (döngü çalıştı = erken return değil)');
    }

    public function test_valid_snowie_overwrites_as_authoritative(): void
    {
        // Mevcut review checker 20 -> Snowie 20.5 geçerli (<=max+2), YAZILMALI.
        $mr = $this->row('OK1', 'white');
        MatchResult::where('id', $mr->id)->update([
            'gnubg_pr' => 16.0, 'gnubg_checker_pr' => 20.0, 'gnubg_cube_pr' => 0.0, 'pr' => 16.0,
        ]);
        $this->fakeSnowie(
            ['pr' => 20.5, 'checker_pr' => 20.5, 'cube_pr' => 0.0, 'cube_equity_lost' => 0, 'cube_decisions' => 0, 'equity_lost' => 1.025, 'decisions' => 50],
            ['pr' => 9.0, 'checker_pr' => 9.0, 'cube_pr' => 0.0, 'cube_equity_lost' => 0, 'cube_decisions' => 0, 'equity_lost' => 0.45, 'decisions' => 50],
        );

        (new AnalyzeMatchSnowieJob($mr->id))->handle($this->healthyGnubg());

        $mr->refresh();
        $this->assertEqualsWithDelta(20.5, (float) $mr->gnubg_pr, 1e-6, 'geçerli Snowie otoriter -> per-pozisyon 16.0yı EZER');
        $this->assertNotNull($mr->pr_shield_at, 'işlendi -> damga konmalı (resumable)');
    }

    /**
     * TEK PR KAYNAĞI'nın ÇEKİRDEK garantisi: Snowie TEK analizden odanın İKİ satırını renk-eşlemeli yazar
     * -> white.gnubg_pr == black.gnubg_opponent_pr ve tersi DAİMA tutar. (DRHK8'de bu çapraz tutmuyordu:
     * opp'u ayrı per-pozisyon motor yazıyordu; o motor artık PR yazmıyor -> tek yazar Snowie.)
     */
    public function test_both_rows_cross_consistent_from_single_analysis(): void
    {
        $w = $this->row('XROOM', 'white');
        $b = $this->row('XROOM', 'black');
        $this->fakeSnowie(
            ['pr' => 6.0, 'checker_pr' => 6.0, 'cube_pr' => 0.0, 'cube_equity_lost' => 0, 'cube_decisions' => 0, 'equity_lost' => 0.6, 'decisions' => 50],
            ['pr' => 18.0, 'checker_pr' => 18.0, 'cube_pr' => 0.0, 'cube_equity_lost' => 0, 'cube_decisions' => 0, 'equity_lost' => 1.8, 'decisions' => 50],
        );

        (new AnalyzeMatchSnowieJob($w->id))->handle($this->healthyGnubg());

        $w->refresh();
        $b->refresh();
        $this->assertEqualsWithDelta(6.0, (float) $w->gnubg_pr, 1e-6, 'white self = snow[white]');
        $this->assertEqualsWithDelta(18.0, (float) $b->gnubg_pr, 1e-6, 'black self = snow[black]');
        // Çapraz: tek analiz -> self == rakibin bana bakışı (her iki yön).
        $this->assertEqualsWithDelta((float) $w->gnubg_pr, (float) $b->gnubg_opponent_pr, 1e-6, 'white.self == black.opp');
        $this->assertEqualsWithDelta((float) $b->gnubg_pr, (float) $w->gnubg_opponent_pr, 1e-6, 'black.self == white.opp');
    }
}
