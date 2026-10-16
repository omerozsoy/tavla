<?php

namespace Tests\Feature;

use App\Services\Analysis\GnubgSnowieService;
use Tests\TestCase;

/**
 * OTORİTER PR = gnubg'nin KENDİ Snowie error rate'i (XG ile birebir). Parser, GnuBgClient::analyzeMatch
 * çıktısından per-oyuncu pr/checker_pr/cube_pr çıkarır. Kanıt: gerçek maç 7669 (By_tgg vs KUPABEYİ)
 * gnubg ham istatistiği — By_tgg Snowie 51.4 (XG 56.24 ~birebir), eski review-log yöntemi 327 veriyordu.
 */
class SnowiePrTest extends TestCase
{
    private function stats7669(): string
    {
        // gnubg "show statistics match" ham çıktısı (maç 7669, kısaltılmış ama parser için yeterli).
        return <<<'TXT'
Player                                   By_tgg                  KUPABEYİ

Checkerplay statistics

Total moves                               25                      25
Unforced moves                            19                      14
Error total EMG (MWC)                         -2.019 (-20.080%)       -9.318 (-92.689%)
Error rate mEMG (MWC)                       -106.2   ( -1.057%)     -665.6   ( -6.621%)

Cube statistics

Total cube decisions                      25                      24
Close or actual cube decisions             5                       3
Error total EMG (MWC)                         -0.550 ( -5.471%)       -0.225 ( -2.235%)
Error rate mEMG (MWC)                       -110.0   ( -1.094%)      -74.9   ( -0.745%)

Overall statistics

Error total EMG (MWC)                         -2.569 (-25.550%)       -9.543 (-94.924%)
Error rate mEMG (MWC)                       -107.0   ( -1.065%)     -561.3   ( -5.584%)
Snowie error rate                            -51.4   ( +0.000%)     -190.9   ( +0.000%)
Overall rating                           Awful!                  Awful!
TXT;
    }

    public function test_snowie_pr_matches_gnubg_and_splits_consistently(): void
    {
        $svc = new GnubgSnowieService;
        $res = [
            'ok' => true,
            'players' => [['snowieErrorRate' => -51.4], ['snowieErrorRate' => -190.9]],
            'statistics_match' => $this->stats7669(),
        ];
        $out = $svc->snowieFromAnalyze($res);
        $this->assertIsArray($out);

        // p0 By_tgg: pr = |Snowie| = 51.4 (XG 56.24 ile ~birebir; bizim eski 327 YANLIŞTI).
        $this->assertNotNull($out[0]);
        $this->assertEqualsWithDelta(51.4, $out[0]['pr'], 0.1);
        // checker/cube = pr'ı hata-oranına böl: 51.4 × 2.019/2.569 = 40.39 ; 51.4 × 0.550/2.569 = 11.01.
        $this->assertEqualsWithDelta(40.39, $out[0]['checker_pr'], 0.2);
        $this->assertEqualsWithDelta(11.01, $out[0]['cube_pr'], 0.2);
        // tutarlılık: checker + cube ≈ overall pr.
        $this->assertEqualsWithDelta($out[0]['pr'], $out[0]['checker_pr'] + $out[0]['cube_pr'], 0.1);
        $this->assertSame(5, $out[0]['cube_decisions']);

        // p1 KUPABEYİ: Snowie 190.9 > 100 çöp koruması -> null (imkansız, gösterilmez).
        $this->assertNull($out[1]);
    }

    public function test_cube_pr_suppressed_below_min_decisions(): void
    {
        $svc = new GnubgSnowieService;
        // Küp kararı 2 (<3) -> cube_pr null; pr + checker_pr yine döner.
        $raw = str_replace('             5                       3', '             2                       1', $this->stats7669());
        $res = [
            'ok' => true,
            'players' => [['snowieErrorRate' => -51.4], ['snowieErrorRate' => -190.9]],
            'statistics_match' => $raw,
        ];
        $out = $svc->snowieFromAnalyze($res);
        $this->assertNotNull($out[0]);
        $this->assertNull($out[0]['cube_pr'], 'küp kararı <3 -> cube_pr gizlenir');
        $this->assertEqualsWithDelta(51.4, $out[0]['pr'], 0.1);
    }
}
