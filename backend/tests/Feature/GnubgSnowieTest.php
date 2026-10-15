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
