<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Setting;
use App\Models\User;
use App\Services\CareerPrService;
use App\Support\RankDivisions;
use App\Support\RankProgress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * RankProgress: YENİ rütbe sistemi (rating + PR + EP) türetilmiş değerleri.
 *  - EP = Σ match_length (1 ve 3 puanlık HARİÇ)
 *  - Pencere PR = son WINDOW_EP EP'lik maçlarda karar-ağırlıklı gnubg_pr
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

    // Karar-ağırlıklı pencere PR + EP toplamı. (2×100 + 8×20)/120 = 3.00; EP = 5+5 = 10.
    public function test_window_pr_weighted_and_ep_sum(): void
    {
        $u = $this->user('a');
        $this->mr($u, 2.0, 100, 5);
        $this->mr($u, 8.0, 20, 5);

        $p = RankProgress::forUser($u);
        $this->assertEqualsWithDelta(3.00, $p['window_pr'], 0.001);
        $this->assertSame(10, $p['ep']);
    }

    // 1 ve 3 puanlık maçlar EP'ye ve pencereye GİRMEZ.
    public function test_one_and_three_point_matches_excluded(): void
    {
        $u = $this->user('b');
        $this->mr($u, 4.0, 100, 5);
        $this->mr($u, 99.0, 100, 1); // 1 puanlık -> hariç
        $this->mr($u, 99.0, 100, 3); // 3 puanlık -> hariç

        $p = RankProgress::forUser($u);
        $this->assertSame(5, $p['ep']);                    // yalnız 5 puanlık
        $this->assertEqualsWithDelta(4.00, $p['window_pr'], 0.001); // 99'lar karışmadı
    }

    // Pencere son WINDOW_EP EP ile sınırlı: eski maç PR'a girmez ama toplam EP'ye sayılır.
    public function test_window_bounded_by_recent_ep(): void
    {
        $u = $this->user('c');
        $this->mr($u, 2.0, 100, 200);  // en eski (düşük id)
        $this->mr($u, 10.0, 100, 200); // pencere içinde
        $this->mr($u, 10.0, 100, 200); // en yeni, pencere içinde

        $p = RankProgress::forUser($u);
        // Son 400 EP = iki 10-PR maçı -> pencere PR = 10 (eski 2-PR hariç).
        $this->assertEqualsWithDelta(10.00, $p['window_pr'], 0.001);
        $this->assertSame(600, $p['ep']);          // toplam yine 600
        $this->assertSame(RankProgress::WINDOW_EP, $p['window_ep']);
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

    // PR penceresi admin ayarı (rank_pr_window_ep) forUser'ı etkiler.
    public function test_window_ep_setting_controls_window(): void
    {
        Setting::put('rank_pr_window_ep', '100');
        $this->assertSame(100, RankProgress::windowEp());

        $u = $this->user('w');
        $this->mr($u, 2.0, 100, 100); // en eski, pencere dışı (100 EP sınırı)
        $this->mr($u, 10.0, 100, 100); // en yeni, pencere içi
        $p = RankProgress::forUser($u);
        $this->assertEqualsWithDelta(10.0, $p['window_pr'], 0.001); // yalnız son 100 EP
        $this->assertSame(200, $p['ep']); // toplam yine 200
    }
}
