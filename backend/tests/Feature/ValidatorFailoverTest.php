<?php

namespace Tests\Feature;

use App\Services\MoveValidatorService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Yedekli (failover) validator: birincil (url) düşük/erişilemez olduğunda istek yedeğe (url_backup)
 * geçer -> tek örnek düşse de otoriter maç DONMAZ. HEPSİ düşerse fail-closed (unreachable).
 */
class ValidatorFailoverTest extends TestCase
{
    private function state(): array
    {
        return ['points' => array_fill(0, 26, 0), 'turn' => 'white', 'dice' => [3, 1], 'diceUsed' => [false, false]];
    }

    public function test_validate_falls_back_to_backup_when_primary_down(): void
    {
        Http::fake([
            'http://primary.test/*' => Http::response(null, 500),                             // birincil DÜŞÜK
            'http://backup.test/*' => Http::response(['valid' => true, 'state' => ['ok' => 1]], 200), // yedek AYAKTA
        ]);
        config(['validator.url' => 'http://primary.test', 'validator.url_backup' => 'http://backup.test']);

        $res = (new MoveValidatorService())->validate($this->state(), []);

        $this->assertTrue($res['valid']);              // yedek yanıtladı -> maç durmadı
        $this->assertEmpty($res['unreachable'] ?? null);
    }

    public function test_validate_unreachable_when_all_bases_down(): void
    {
        Http::fake(['*' => Http::response(null, 500)]); // tüm tabanlar düşük
        config(['validator.url' => 'http://primary.test', 'validator.url_backup' => 'http://backup.test']);

        $res = (new MoveValidatorService())->validate($this->state(), []);

        $this->assertFalse($res['valid']);
        $this->assertTrue((bool) ($res['unreachable'] ?? false)); // fail-closed
    }

    public function test_comma_separated_backups_are_tried_in_order(): void
    {
        Http::fake([
            'http://a.test/*' => Http::response(null, 500),
            'http://b.test/*' => Http::response(null, 500),
            'http://c.test/*' => Http::response(['moves' => [['steps' => []]]], 200),
        ]);
        config(['validator.url' => 'http://a.test', 'validator.url_backup' => 'http://b.test, http://c.test']);

        $moves = (new MoveValidatorService())->legalMoves($this->state());

        $this->assertIsArray($moves);
        $this->assertCount(1, $moves); // 3. taban (c) yanıtladı
    }

    public function test_primary_answer_used_without_touching_backup(): void
    {
        Http::fake([
            'http://primary.test/*' => Http::response(['valid' => false, 'reason' => 'illegal'], 200), // MEŞRU cevap
            'http://backup.test/*' => Http::response(['valid' => true], 200),
        ]);
        config(['validator.url' => 'http://primary.test', 'validator.url_backup' => 'http://backup.test']);

        $res = (new MoveValidatorService())->validate($this->state(), []);

        // Birincil 2xx "geçersiz hamle" MEŞRU yanıttır -> failover TETİKLENMEZ (yedeğe geçilmez).
        $this->assertFalse($res['valid']);
        $this->assertSame('illegal', $res['reason']);
    }

    // AĞIR İZOLASYON: heavy_url verilince /analyze-pr ADANMIŞ instance'a gider (validate'e DEĞİL)
    // -> sinir ağı analizi canlı /validate instance'ının event-loop'unu bloklamaz.
    public function test_analyze_pr_routes_to_dedicated_heavy_base(): void
    {
        Http::fake([
            'http://validate.test/*' => Http::response(null, 500),                          // validate instance'ı kullanılMAMALI
            'http://heavy.test/*' => Http::response(['pr' => 5.0, 'decisions' => 10], 200),  // ağır instance
        ]);
        config([
            'validator.url' => 'http://validate.test',
            'validator.heavy_url' => 'http://heavy.test',
        ]);

        $res = (new MoveValidatorService())->analyzePr('X', [['dummy' => 1]]);

        $this->assertNotNull($res);                 // heavy yanıtladı (validate 500'de olsa bile)
        $this->assertEqualsWithDelta(5.0, $res['pr'], 0.001);
        $this->assertSame(10, $res['decisions']);
        Http::assertSent(fn ($req) => str_starts_with($req->url(), 'http://heavy.test/analyze-pr'));
        Http::assertNotSent(fn ($req) => str_contains($req->url(), 'validate.test'));
    }

    // heavy_url BOŞSA /analyze-pr normal url'e düşer (davranış değişmez; adanmış instance opsiyonel).
    public function test_analyze_pr_falls_back_to_normal_url_when_heavy_unset(): void
    {
        Http::fake(['http://primary.test/*' => Http::response(['pr' => 3.0, 'decisions' => 4], 200)]);
        config(['validator.url' => 'http://primary.test', 'validator.heavy_url' => '', 'validator.heavy_url_backup' => '']);

        $res = (new MoveValidatorService())->analyzePr('X', [['dummy' => 1]]);

        $this->assertNotNull($res);
        $this->assertEqualsWithDelta(3.0, $res['pr'], 0.001);
        Http::assertSent(fn ($req) => str_starts_with($req->url(), 'http://primary.test/analyze-pr'));
    }
}
