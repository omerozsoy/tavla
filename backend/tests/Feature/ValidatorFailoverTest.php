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
}
