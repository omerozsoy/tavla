<?php

namespace Tests\Feature;

use App\Support\MatBuilder;
use Tests\TestCase;

// PHP MatBuilder, TS buildMat'in BİREBİR portu olmalı. Fixture: matExport.botcheck.test.ts aynı
// (deterministik) botu oynatıp HEM .mat'i HEM log JSON'unu yazar. Bu test log'u PHP'de üretip
// .mat'i TS çıktısıyla KARAKTER-KARAKTER karşılaştırır -> port parite garantisi.
class MatBuilderTest extends TestCase
{
    public function test_php_matbuilder_matches_ts_buildmat_exactly(): void
    {
        $dir = base_path('tests/Fixtures');
        $logPath = "$dir/bot-match-log.json";
        $matPath = "$dir/bot-match.mat";
        if (! is_file($logPath) || ! is_file($matPath)) {
            $this->markTestSkipped('Fixture yok — `npx vitest run src/matExport.botcheck.test.ts` çalıştır.');
        }
        $log = json_decode((string) file_get_contents($logPath), true);
        $expected = (string) file_get_contents($matPath);

        $actual = MatBuilder::build($log, 1, 'Omer', 'GnuBot');

        $this->assertSame($expected, $actual, 'PHP MatBuilder çıktısı TS buildMat ile BİREBİR aynı olmalı');
    }

    public function test_merge_logs_takes_own_color_from_each(): void
    {
        // Her oyuncunun logu KENDİ renginde tam + rakip renginde ÇÖP (eksik) içersin. mergeLogs
        // her oyuncunun KENDİ renginin girişlerini KENDİ logundan almalı (çöpü atmalı).
        $whiteLog = [
            ['player' => 'white', 'notation' => '8/5 6/5', 'dice' => [3, 1], 'seq' => 0],
            ['player' => 'black', 'notation' => 'BOZUK', 'dice' => [], 'seq' => 1], // beyazın gördüğü çöp
        ];
        $blackLog = [
            ['player' => 'white', 'notation' => 'BOZUK', 'dice' => [], 'seq' => 0], // siyahın gördüğü çöp
            ['player' => 'black', 'notation' => '24/21 13/11', 'dice' => [3, 2], 'seq' => 1],
        ];
        $merged = MatBuilder::mergeLogs($whiteLog, $blackLog);
        $this->assertCount(2, $merged);
        $mat = MatBuilder::build($merged, 1, 'W', 'B');
        $this->assertStringContainsString('8/5 6/5', $mat);       // beyazın gerçek hamlesi
        $this->assertStringContainsString('24/21 13/11', $mat);   // siyahın gerçek hamlesi
        $this->assertStringNotContainsString('BOZUK', $mat);      // çöp elenmeli
    }
}
