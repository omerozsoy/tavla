<?php

namespace Tests\Feature;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// SAHTE "düştü" KÖK ÇÖZÜM regresyonu: analyzeBackgroundBatch artık pencereli (instance başına ~4
// eş-zamanlı) -> pozisyon sayısı pencereyi aşınca BİRDEN ÇOK tur açılır. Bu testin kanıtladığı:
// çok-tur (chunk) yolunda hiçbir pozisyon DÜŞMEZ ve her anahtar KENDİ yanıtına eşlenir (karışma yok).
class GnuBgBatchWindowTest extends TestCase
{
    public function test_windowed_batch_preserves_every_key_across_multiple_chunks(): void
    {
        config()->set('gnubg.analysis_urls', 'http://127.0.0.1:9001,http://127.0.0.1:9002'); // n=2 -> pencere=8
        config()->set('gnubg.secret', 'test-secret');

        // Her /analyze isteğini gönderdiği 'id' ile yanıtla -> anahtar<->yanıt eşlemesi doğrulanabilir.
        Http::fake(function ($request) {
            $body = json_decode($request->body(), true) ?: [];

            return Http::response(['id' => $body['id'] ?? null, 'ok' => true], 200);
        });

        // 10 pozisyon > pencere(8) -> 2 tur (8 + 2). Anahtarlar kasıtlı sırasız/dağınık.
        $positions = [];
        for ($i = 0; $i < 10; $i++) {
            $positions['pos-'.$i] = ['id' => $i, 'points' => array_fill(0, 24, 0)];
        }

        $out = (new GnuBgClient())->analyzeBackgroundBatch($positions);

        $this->assertCount(10, $out);
        foreach ($positions as $k => $p) {
            $this->assertNotNull($out[$k], "anahtar {$k} null döndü (pozisyon düştü)");
            $this->assertSame($p['id'], $out[$k]['id'], "anahtar {$k} YANLIŞ yanıta eşlendi (karışma)");
        }
    }
}
