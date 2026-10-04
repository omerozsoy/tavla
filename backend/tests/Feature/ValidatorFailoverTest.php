<?php

namespace Tests\Feature;

use App\Services\MoveValidatorService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// A-31: hatalı istek (400) her yedek validator'a tekrar gönderilip "erişilemez" alarmı üretiyordu.
class ValidatorFailoverTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['validator.url' => 'http://v1.test', 'validator.url_backup' => 'http://v2.test,http://v3.test', 'validator.secret' => 's']);
    }

    public function test_bad_request_is_not_retried_on_backups(): void
    {
        $hits = [];
        Http::fake(function (Request $r) use (&$hits) {
            $hits[] = $r->url();

            return Http::response(['error' => 'bad-json'], 400);
        });
        (new MoveValidatorService())->validate(['points' => []], []);
        $this->assertCount(1, $hits);
    }

    public function test_server_error_still_fails_over(): void
    {
        $hits = [];
        Http::fake(function (Request $r) use (&$hits) {
            $hits[] = $r->url();

            return count($hits) === 1 ? Http::response([], 503) : Http::response(['valid' => true], 200);
        });
        $res = (new MoveValidatorService())->validate(['points' => []], []);
        $this->assertTrue($res['valid']);
        $this->assertCount(2, $hits);
    }
}
