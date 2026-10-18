<?php

namespace Tests\Feature;

use App\Jobs\CacheMatchReviewJob;
use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * REGRESYON KALKANI (kalıcı "—" + kariyer maç sayısı yarılanması): review/snowie bir tarafı (p2/siyah,
 * .mat sağ-sütun çıkarımı boş) skorlayamayınca o tarafın gnubg_pr'ını NULL ile EZMEMELİ -> AnalyzeMatchPrJob'ın
 * per-pozisyon değeri KORUNUR. Bu clobber ~bir düzine manuel backfill'in kök nedeniydi; biri koşulsuz
 * null-write'a dönerse bu test kırılsın.
 */
class ReviewPrNoClobberTest extends TestCase
{
    use RefreshDatabase;

    public function test_review_does_not_null_out_unscored_side(): void
    {
        if (! Schema::hasColumn('match_results', 'gnubg_pr')) {
            $this->markTestSkipped('gnubg_pr kolonu yok');
        }

        // white: >=MIN_PR_DECISIONS(6) sayılan checker kararı -> prW dolu.
        // black: yalnız 1 ZORUNLU (tek aday) -> decisions=0 < MIN -> prB null.
        $log = [];
        for ($i = 0; $i < 6; $i++) {
            $log[] = ['player' => 'white', 'dice' => [3, 1], 'loss' => 0.05,
                'cands' => [['equity' => 0.5], ['equity' => 0.3]]];
        }
        $log[] = ['player' => 'black', 'dice' => [6, 6], 'loss' => 0.0, 'cands' => [['equity' => 0.1]]];

        $uw = User::factory()->create();
        $ub = User::factory()->create();
        $white = MatchResult::create([
            'user_id' => $uw->id, 'won' => true, 'room_code' => 'TSTROOM',
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1516,
            'delta' => 16, 'match_length' => 7, 'match_type' => 'match',
            'log' => json_encode(['hc' => 'white']),
        ]);
        $black = MatchResult::create([
            'user_id' => $ub->id, 'won' => false, 'room_code' => 'TSTROOM',
            'opponent_rating' => 1500, 'rating_before' => 1500, 'rating_after' => 1484,
            'delta' => -16, 'match_length' => 7, 'match_type' => 'match',
            'log' => json_encode(['hc' => 'black']),
        ]);
        // gnubg_pr fillable değil -> query-builder ile seed (white sentinel 99, black KORUNACAK 10.0).
        MatchResult::where('id', $white->id)->update(['gnubg_pr' => 99.0]);
        MatchResult::where('id', $black->id)->update(['gnubg_pr' => 10.0]);

        // private writePrFromReview'i reflection ile çağır ($mr = fresh white; metot odadaki İKİ satırı gezer).
        $job = new CacheMatchReviewJob($white->id);
        $m = new \ReflectionMethod($job, 'writePrFromReview');
        $m->setAccessible(true);
        $m->invoke($job, $white->fresh(), $log);

        // white: review skorladı -> güncellendi (sentinel 99 gitti, null değil).
        $this->assertNotNull($white->fresh()->gnubg_pr, 'white skorlandı ama gnubg_pr null');
        $this->assertNotEquals(99.0, (float) $white->fresh()->gnubg_pr, 'white gnubg_pr güncellenmedi');

        // black: review skorlayamadı -> ESKİ per-pozisyon değeri KORUNDU (null'a EZİLMEDİ). Kök kalkanı.
        $this->assertSame(10.0, (float) $black->fresh()->gnubg_pr, 'black gnubg_pr null ile ezildi (REGRESYON)');
    }
}
