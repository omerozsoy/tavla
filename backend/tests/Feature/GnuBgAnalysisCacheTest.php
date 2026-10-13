<?php

namespace Tests\Feature;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * #4 memoization: analyzeBackgroundBatch pozisyonu içerik-hash'iyle önbelleğe alır. İkinci kez AYNI
 * pozisyon istenince gnubg'ye GİTMEZ (cache hit) ama AYNI sonucu döndürür (PR matematiği değişmez).
 */
class GnuBgAnalysisCacheTest extends TestCase
{
    public function test_identical_position_is_served_from_cache_second_time(): void
    {
        config([
            'gnubg.analysis_urls' => 'http://127.0.0.1:9999',
            'gnubg.analysis_cache' => true,
            'gnubg.secret' => 'x',
            'gnubg.timeout' => 5,
        ]);
        Http::fake(['*/analyze' => Http::response(['result' => ['hint' => []], 'played' => ['loss' => 0.1]], 200)]);

        $client = app(GnuBgClient::class);
        $pos = ['points' => [1, 2, 3], 'turn' => 'white', 'dice' => [3, 1]];

        $first = $client->analyzeBackgroundBatch([0 => $pos]);
        $second = $client->analyzeBackgroundBatch([0 => $pos]);

        $this->assertSame($first[0], $second[0]);        // aynı sonuç
        Http::assertSentCount(1);                        // ikinci çağrı gnubg'ye GİTMEDİ (cache)
    }

    public function test_cache_disabled_always_hits_gnubg(): void
    {
        config([
            'gnubg.analysis_urls' => 'http://127.0.0.1:9999',
            'gnubg.analysis_cache' => false,
            'gnubg.secret' => 'x',
            'gnubg.timeout' => 5,
        ]);
        Http::fake(['*/analyze' => Http::response(['result' => ['hint' => []], 'played' => ['loss' => 0.1]], 200)]);

        $client = app(GnuBgClient::class);
        $pos = ['points' => [1], 'turn' => 'black', 'dice' => [6, 6]];

        $client->analyzeBackgroundBatch([0 => $pos]);
        $client->analyzeBackgroundBatch([0 => $pos]);

        Http::assertSentCount(2); // kapalıyken her çağrı gnubg'ye gider
    }
}
