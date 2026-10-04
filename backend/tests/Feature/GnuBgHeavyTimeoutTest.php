<?php

namespace Tests\Feature;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// A-27: ağır analiz (review/analyze .mat) zaman aşımında AYNI yükü sıradaki instance'a (canlı PR havuzu
// dahil) gönderiyordu; gnubg işi iptal edemediği için tek kullanıcı tüm havuzu N × 600 sn kilitliyordu.
class GnuBgHeavyTimeoutTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['gnubg.heavy_urls' => 'http://h1.test,http://h2.test', 'gnubg.background_urls' => 'http://bg.test',
            'gnubg.secret' => 's']);
    }

    public function test_timeout_does_not_fail_over_to_other_instances(): void
    {
        $hits = [];
        Http::fake(function (Request $r) use (&$hits) {
            $hits[] = $r->url();
            throw new ConnectionException('cURL error 28: Operation timed out after 600000 milliseconds');
        });
        $res = app(GnuBgClient::class)->reviewMatch('mat', 2);
        $this->assertFalse($res['ok']);
        $this->assertCount(1, $hits, 'zaman aşımında başka instance denenmemeli: '.implode(',', $hits));
    }

    public function test_connection_refused_still_fails_over(): void
    {
        $hits = [];
        Http::fake(function (Request $r) use (&$hits) {
            $hits[] = $r->url();
            if (count($hits) === 1) {
                throw new ConnectionException('cURL error 7: Failed to connect: Connection refused');
            }

            return Http::response(['ok' => true, 'log' => []], 200);
        });
        $res = app(GnuBgClient::class)->reviewMatch('mat', 2);
        $this->assertTrue($res['ok']);
        $this->assertCount(2, $hits);
    }
}
