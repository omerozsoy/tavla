<?php

namespace Tests\Feature;

use App\Services\Analysis\GnubgSnowieService;
use Tests\TestCase;

/**
 * KİLİT: PR = gnubg Snowie error rate (maç-cubeful, küp dahil, XG-eşleşen). Bu test, hesabın
 * bir daha SESSİZCE bozulmamasını garanti eder:
 *   - parse testi (CI): kanned çıktı -> doğru PR ayıklama (regex/parse sapması yakalanır).
 *   - canlı test (gnubg varsa): fixture .mat -> Snowie ~2.3 (XG 2.02). Ply/equity ayarı kayarsa KIRILIR.
 *
 * Referans (gnubg 2-ply, cubeful): 59C8M OmerDOGAN 2.3 (XG 2.02) | ahselbah 14.7 (XG 13.34).
 */
class GnubgSnowieTest extends TestCase
{
    public function test_parse_snowie_from_statistics_output(): void
    {
        $svc = new GnubgSnowieService;
        // gnubg "show statistics match" çıktısının ilgili satırları (gerçek 59C8M 2-ply).
        $text = <<<TXT
        Player                                   OmerDOGAN               ahselbah
        Chequerplay statistics
        Snowie error rate                             -2,3   ( +0,000%)      -14,7   ( +0,000%)
        Overall rating                           World class             Awful!
        TXT;
        $r = $svc->parseSnowie($text);
        $this->assertNotNull($r);
        [$p1, $p2, $pr1, $pr2] = $r;
        $this->assertSame('OmerDOGAN', $p1);
        $this->assertSame('ahselbah', $p2);
        $this->assertSame(2.3, $pr1);
        $this->assertSame(14.7, $pr2);
    }

    public function test_parse_returns_null_without_snowie_line(): void
    {
        $svc = new GnubgSnowieService;
        $this->assertNull($svc->parseSnowie("Player  A  B\nsome other output"));
    }

    public function test_parse_rejects_absurd_pr(): void
    {
        // Canlı-küplü money maçı "1 point match" başlığıyla gnubg'ye verilince küpü ölü sanıp
        // milyonluk hata üretir -> güvenilmez, null dönmeli (DB'ye çöp PR yazılmaz).
        $svc = new GnubgSnowieService;
        $text = "Player  OmerDOGAN  ahselbah\nSnowie error rate  -60,4  ( +0,000%)  -11111002,9  ( +0,000%)";
        $this->assertNull($svc->parseSnowie($text));
    }

    /**
     * HİBRİT PR = min(EMG, Snowie). EMG = ovErr/(zorunlu-dışı+yakın küp)×500 (XG tanımı); büyük küp
     * hatasında gnubg 2-ply şişince Snowie tavan. Canned istatistik -> ikisini de doğrular (regex +
     * formül + min seçimi). gnubg CLI GEREKMEZ (saf parse) -> CI'da da koşar.
     */
    public function test_hybrid_min_emg_snowie(): void
    {
        $svc = new GnubgSnowieService;
        // GERÇEK 36P7S 2-ply istatistiği (col0=Zknkyc/white, col1=ÖmerDOĞAN/black).
        // EMG: Zknkyc 0.770/(28+4)*500=12.03 (<Snowie 12.4 -> EMG). Ömer 0.374/(30+11)*500=4.56
        // (<Snowie 6.0 -> EMG, XG 4.63'e birebir). Eski kod Snowie'yi (6.0) yazıyordu = şişik.
        $text = <<<TXT
        Player                                   Zknkyc                  ÖmerDOĞAN
        Checkerplay statistics
        Unforced moves                            28                      30
        Error total EMG (MWC)                         -0.599 (-13.454%)       -0.102 ( -1.016%)
        Cube statistics
        Close or actual cube decisions             4                      11
        Error total EMG (MWC)                         -0.171 ( -1.696%)       -0.272 ( -3.312%)
        Overall statistics
        Error total EMG (MWC)                         -0.770 (-15.150%)       -0.374 ( -4.328%)
        Snowie error rate                            -12.4   ( +0.000%)       -6.0   ( +0.000%)
        TXT;
        $res = ['ok' => true, 'players' => [['snowieErrorRate' => 12.4], ['snowieErrorRate' => 6.0]], 'statistics_match' => $text];
        $r = $svc->snowieFromAnalyze($res, 1);
        $this->assertNotNull($r);
        $this->assertEqualsWithDelta(12.03, $r[0]['pr'], 0.05, 'Zknkyc EMG seçilmeli (12.03 < Snowie 12.4)');
        $this->assertEqualsWithDelta(4.56, $r[1]['pr'], 0.05, 'Ömer EMG=4.56 (XG 4.63) seçilmeli, Snowie 6.0 DEĞİL');
        // Bileşenler genel PR'ı havuzlar: checker+cube ≈ overall (hata-oranı bölüşümü).
        $this->assertEqualsWithDelta(1.24, $r[1]['checker_pr'], 0.05);
        $this->assertEqualsWithDelta(3.32, $r[1]['cube_pr'], 0.05);

        // DAMPING: EMG büyük küp hatasıyla şişerse (21.87) Snowie (14.7) TAVAN olur.
        $text2 = <<<TXT
        Player                                   A                       B
        Checkerplay statistics
        Unforced moves                            34                      34
        Error total EMG (MWC)                         -0.537 ( -5.000%)       -0.537 ( -5.000%)
        Cube statistics
        Close or actual cube decisions             9                       9
        Error total EMG (MWC)                         -1.344 (-13.000%)       -1.344 (-13.000%)
        Overall statistics
        Error total EMG (MWC)                         -1.881 (-18.000%)       -1.881 (-18.000%)
        Snowie error rate                            -14.7   ( +0.000%)      -14.7   ( +0.000%)
        TXT;
        $r2 = $svc->snowieFromAnalyze(['ok' => true, 'players' => [['snowieErrorRate' => 14.7], ['snowieErrorRate' => 14.7]], 'statistics_match' => $text2], 1);
        $this->assertEqualsWithDelta(14.7, $r2[0]['pr'], 0.1, 'EMG 21.87 şişik -> Snowie 14.7 tavanı seçilmeli');
    }

    /**
     * CANLI REGRESYON: gerçek gnubg ile fixture maçı analiz et -> Snowie PR XG'ye yakın olmalı.
     * gnubg CLI yoksa (CI) atlanır; local/prod'da KİLİT görevi görür.
     */
    public function test_live_gnubg_snowie_matches_xg(): void
    {
        $svc = new GnubgSnowieService;
        if (! is_file($svc->cliPath())) {
            $this->markTestSkipped('gnubg CLI yok ('.$svc->cliPath().') — canlı test atlandı.');
        }
        $mat = file_get_contents(__DIR__.'/../Fixtures/snowie_59c8m.mat');
        $r = $svc->analyzeMat($mat); // 2-ply, cubeful (SABİT)
        $this->assertNotNull($r, 'gnubg analizi sonuç vermedi');
        [, , $pr1, $pr2] = $r;
        // Ply/equity ayarı bozulursa bu değerler kayar -> test kırılır (erken uyarı).
        $this->assertEqualsWithDelta(2.3, $pr1, 0.4, "OmerDOGAN Snowie XG'den (2.02) çok saptı: $pr1");
        $this->assertEqualsWithDelta(14.7, $pr2, 1.0, "ahselbah Snowie XG'den (13.34) çok saptı: $pr2");
    }
}
