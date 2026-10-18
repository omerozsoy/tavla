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
        // kariyer alanları: equity_lost=overall err (2.569), decisions=tüm hamle+küp (25+25=50).
        $this->assertEqualsWithDelta(2.569, $out[0]['equity_lost'], 0.01);
        $this->assertSame(50, $out[0]['decisions']);
        // tutarlılık: Snowie = equity_lost/decisions × 1000 = 2.569/50×1000 = 51.4.
        $this->assertEqualsWithDelta($out[0]['pr'], $out[0]['equity_lost'] / $out[0]['decisions'] * 1000, 0.3);

        // p1 KUPABEYİ: Snowie 190.9 -> XG gibi 100'e CAP'lenir (null DEĞİL; XG 100.00 gösteriyor).
        $this->assertNotNull($out[1]);
        $this->assertEqualsWithDelta(100.0, $out[1]['pr'], 0.1);

        // BOZUK-analiz (milyonlar) yine null (cap değil): >1000 = güvenilmez gnubg (ör. canlı-küplü
        // maç "1 point" başlığıyla -> küp ölü sanılır). Garbage artık HAM METİNDEKİ Snowie oranında:
        // snowieFromAnalyze otorite olarak ham "Snowie error rate" satırını okur (players[] yalnız
        // fallback — Python servisi 2. oyuncu için bazen 0 veriyordu, o yüzden metin otorite oldu).
        $garbage = [
            'ok' => true,
            'players' => [['snowieErrorRate' => -5000.0], ['snowieErrorRate' => -3.2]],
            'statistics_match' => str_replace('-51.4', '-5000.0', $this->stats7669()),
        ];
        $g = $svc->snowieFromAnalyze($garbage);
        $this->assertNull($g[0], 'milyonluk/>1000 Snowie -> null (bozuk analiz)');
        $this->assertNotNull($g[1]); // 190.9 -> 100'e CAP (null değil)
    }

    public function test_cube_pr_shown_with_few_decisions_xg(): void
    {
        $svc = new GnubgSnowieService;
        // XG-birebir: eşik YOK -> az küp kararında da (2) küp PR GÖSTERİLİR (null değil).
        $raw = str_replace('             5                       3', '             2                       1', $this->stats7669());
        $res = [
            'ok' => true,
            'players' => [['snowieErrorRate' => -51.4], ['snowieErrorRate' => -190.9]],
            'statistics_match' => $raw,
        ];
        $out = $svc->snowieFromAnalyze($res); // default minCubeDecisions=1 (XG)
        $this->assertNotNull($out[0]);
        $this->assertNotNull($out[0]['cube_pr'], 'XG: 2 küp kararında da küp PR gösterilir');
        $this->assertEqualsWithDelta(11.01, $out[0]['cube_pr'], 0.2);
        // Yalnız 0 küp kararında null (bölünecek karar yok).
        $out0 = $svc->snowieFromAnalyze($res, 1);
        $this->assertNotNull($out0[0]['cube_pr']);
    }
}
