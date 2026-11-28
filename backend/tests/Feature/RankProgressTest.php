<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\User;
use App\Services\CareerPrService;
use App\Support\RankDivisions;
use App\Support\RankProgress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * RankProgress: YENİ rütbe sistemi (rating + PR + EP) türetilmiş değerleri.
 *  - EP = Σ match_length (jeton/1 puanlık HARİÇ; 3+ puan DAHİL)
 *  - PR = tüm geçerli maçlarda karar-ağırlıklı gnubg_pr (TEK PR; kariyer PR ile aynı, pencere YOK)
 * + RankDivisions EP eşik doğrulaması (azalmayan).
 */
class RankProgressTest extends TestCase
{
    use RefreshDatabase;

    private int $room = 0;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com', 'password' => bcrypt('secret123'),
        ]);
    }

    /** Sonraki insert = daha yüksek id = daha YENİ (created_at eşit, orderByDesc id tiebreak). */
    private function mr(User $u, float $pr, int $dec, int $len, array $over = []): MatchResult
    {
        $mr = MatchResult::create(array_merge([
            'user_id' => $u->id, 'won' => true,
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1500, 'delta' => 0,
            'match_length' => $len, 'match_type' => 'match', 'pr' => round($pr, 2),
            'room_code' => 'R'.(++$this->room),
            'pr_equity_lost' => $pr * $dec / CareerPrService::SCALE, 'pr_decisions' => $dec,
        ], $over));
        $mr->forceFill(['gnubg_pr' => $over['gnubg_pr'] ?? $pr])->save();

        return $mr;
    }

    // Karar-ağırlıklı PR + EP toplamı. (2×100 + 8×20)/120 = 3.00; EP = 5+5 = 10.
    public function test_window_pr_weighted_and_ep_sum(): void
    {
        $u = $this->user('a');
        $this->mr($u, 2.0, 100, 5);
        $this->mr($u, 8.0, 20, 5);

        $p = RankProgress::forUser($u);
        $this->assertEqualsWithDelta(3.00, $p['window_pr'], 0.001);
        $this->assertSame(10, $p['ep']);
    }

    // JETON (1 puanlık) maçlar EP'ye ve PR'a GİRMEZ; 3+ puanlık maçlar GİRER.
    public function test_only_one_point_matches_excluded(): void
    {
        $u = $this->user('b');
        $this->mr($u, 4.0, 100, 5);
        $this->mr($u, 10.0, 100, 3);  // 3 puanlık -> DAHİL (artık hariç değil)
        $this->mr($u, 99.0, 100, 1);  // 1 puanlık (jeton) -> HARİÇ

        $p = RankProgress::forUser($u);
        $this->assertSame(8, $p['ep']);                            // 5 + 3 (jeton hariç)
        // (4×100 + 10×100) / 200 = 7.00; 99'luk jeton karışmadı.
        $this->assertEqualsWithDelta(7.00, $p['window_pr'], 0.001);
    }

    // Pencere YOK: tüm geçerli maçlar (jeton hariç) tek havuzda; eski maçlar da PR'a girer.
    public function test_no_window_all_lifetime_pooled(): void
    {
        $u = $this->user('c');
        $this->mr($u, 2.0, 100, 200);  // en eski
        $this->mr($u, 10.0, 100, 200);
        $this->mr($u, 10.0, 100, 200); // en yeni

        $p = RankProgress::forUser($u);
        // Hepsi havuza girer: (2 + 10 + 10)×100 / 300 = 7.33 (eski 2-PR maçı DAHİL).
        $this->assertEqualsWithDelta(7.33, $p['window_pr'], 0.01);
        $this->assertSame(600, $p['ep']);
        $this->assertSame(600, $p['window_ep']); // pencere kalktı -> window_ep = ep
    }

    // Analizli maçı olmayan oyuncu: window_pr null, ep 0 (provisional).
    public function test_no_matches_null_pr(): void
    {
        $p = RankProgress::forUser($this->user('d'));
        $this->assertNull($p['window_pr']);
        $this->assertSame(0, $p['ep']);
    }

    // EP eşikleri AZALMAYAN olmalı (plato OK, düşüş reddedilir).
    public function test_ep_validation_non_decreasing(): void
    {
        $ok = RankDivisions::defaultEpThresholds();
        $this->assertNull(RankDivisions::validateEp($ok)); // varsayılan geçerli (plato içerir)

        $bad = $ok;
        $bad['div.g2'] = 10; // g3 400'den düşük -> reddedilmeli
        $this->assertNotNull(RankDivisions::validateEp($bad));
    }

    // Admin EP eşiklerini kaydedip okuyabilir (roundtrip; bilinmeyen anahtar atılır).
    public function test_ep_thresholds_roundtrip(): void
    {
        $mins = RankDivisions::defaultEpThresholds();
        $mins['div.g3'] = 777;
        RankDivisions::putEp($mins);
        $this->assertSame(777, RankDivisions::epThresholds()['div.g3']);
    }
}
