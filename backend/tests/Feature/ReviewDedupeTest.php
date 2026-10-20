<?php

namespace Tests\Feature;

use App\Jobs\CacheMatchReviewJob;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * DEDUPE (perf + GÜÇ): reviewMatch çıktısı tüm-maç = odanın İKİ satırı için AYNI. CacheMatchReviewJob
 * artık gnubg_review'i odanın HER satırına yazar -> ikinci oyuncunun job'u guard'a takılıp ağır
 * reviewMatch'i TEKRAR koşmaz (oda başına 1 reviewMatch, 2 değil). Burst'te review worker'ı seri
 * boğan asıl israfın regresyon kalkanı (bkz YZVSQ/YNCJT).
 */
class ReviewDedupeTest extends TestCase
{
    use RefreshDatabase;

    private function rows(): array
    {
        $uw = User::factory()->create();
        $ub = User::factory()->create();
        $mkLog = fn ($hc) => json_encode(['hc' => $hc, 'log' => [
            ['player' => 'white', 'dice' => [3, 1], 'loss' => 0.0, 'cands' => [['equity' => 0.5]]],
        ]]);
        $white = MatchResult::create([
            'user_id' => $uw->id, 'won' => true, 'room_code' => 'DEDUPE1',
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1516,
            'delta' => 16, 'match_length' => 7, 'match_type' => 'match', 'log' => $mkLog('white'),
        ]);
        $black = MatchResult::create([
            'user_id' => $ub->id, 'won' => false, 'room_code' => 'DEDUPE1',
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1484,
            'delta' => -16, 'match_length' => 7, 'match_type' => 'match', 'log' => $mkLog('black'),
        ]);

        return [$white, $black];
    }

    public function test_review_is_written_to_both_room_rows_in_one_pass(): void
    {
        if (! Schema::hasColumn('match_results', 'gnubg_review')) {
            $this->markTestSkipped('gnubg_review kolonu yok');
        }
        Queue::fake(); // Snowie dispatch'i yakala, gerçekten koşturma

        [$white, $black] = $this->rows();

        $gnubg = $this->createMock(GnuBgClient::class);
        $gnubg->method('analyzeHealthy')->willReturn(true);
        $gnubg->expects($this->once()) // TEK reviewMatch (iki değil) — dedup'in özü
            ->method('reviewMatch')
            ->willReturn(['ok' => true, 'log' => [], 'decisions' => 0]);

        (new CacheMatchReviewJob($white->id))->handle($gnubg);

        // Her İKİ satır da review aldı (tek geçişte).
        $this->assertNotNull($white->fresh()->gnubg_review, 'white review yok');
        $this->assertNotNull($black->fresh()->gnubg_review, 'black review tek geçişte yazılmadı');
    }

    public function test_sibling_job_skips_heavy_review_when_already_cached(): void
    {
        if (! Schema::hasColumn('match_results', 'gnubg_review')) {
            $this->markTestSkipped('gnubg_review kolonu yok');
        }
        Queue::fake();

        [$white, $black] = $this->rows();
        // white işi zaten iki satıra da review yazdı (yukarıdaki test). Burada kardeşi (black) simüle et:
        MatchResult::whereIn('id', [$white->id, $black->id])->update(['gnubg_review' => json_encode(['ok' => true])]);

        $gnubg = $this->createMock(GnuBgClient::class);
        $gnubg->method('analyzeHealthy')->willReturn(true);
        $gnubg->expects($this->never())->method('reviewMatch'); // guard tuttu -> ağır çağrı YOK

        (new CacheMatchReviewJob($black->id))->handle($gnubg);
    }
}
