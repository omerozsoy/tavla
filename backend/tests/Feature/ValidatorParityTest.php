<?php

namespace Tests\Feature;

use App\Services\MoveValidatorService;
use App\Support\Backgammon;
use Tests\TestCase;

/**
 * CANLI validator entegrasyon/parite testi (mock DEĞİL).
 *
 * SERVER_AUTHORITATIVE=true iken validator, hamle yasallığının tek hakemidir (fail-closed).
 * Bu test, DEPLOY EDİLMİŞ Node validator'ın el ile doğrulanmış vakalarda DOĞRU davrandığını
 * kanıtlar: yasal hamleyi kabul, yasadışı hamleyi (atılmayan zar / boş noktadan) reddeder,
 * legal-moves ucu çalışır. Böylece "ayakta ama yanlış/rubber-stamp cevaplıyor" durumu yakalanır.
 *
 * VALIDATOR_URL YOKSA (yerel/CI) test ATLANIR. Sunucuda çalıştır:
 *   VALIDATOR_URL=... VALIDATOR_SECRET=... php artisan test --filter=ValidatorParityTest
 * DB kullanmaz (RefreshDatabase yok) — yalnız validator HTTP köprüsünü sınar.
 */
class ValidatorParityTest extends TestCase
{
    private MoveValidatorService $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = app(MoveValidatorService::class);
        if (! $this->validator->isConfigured()) {
            $this->markTestSkipped('VALIDATOR_URL yapılandırılmamış — canlı validator entegrasyon testi atlandı.');
        }
    }

    /** Açılış durumu (beyaz sıra) + verilen zar. */
    private function opening(array $dice): array
    {
        $s = Backgammon::initialState();
        $s['dice'] = $dice;
        $s['diceUsed'] = array_fill(0, count($dice), false);

        return $s;
    }

    public function test_legal_opening_move_accepted(): void
    {
        // Açılış [3,1]: 8/5 6/5 (index: 5->2 die3, 2->1 die1) — klasik en iyi açılışlardan, yasal.
        $r = $this->validator->validate($this->opening([3, 1]), [
            ['from' => 5, 'to' => 2, 'die' => 3],
            ['from' => 2, 'to' => 1, 'die' => 1],
        ]);
        $this->assertEmpty($r['unreachable'] ?? null, 'Validator erişilemez — canlı servisi kontrol et.');
        $this->assertTrue((bool) ($r['valid'] ?? false), 'Yasal açılış hamlesi reddedildi (validator↔motor uyumsuz).');
        $this->assertIsArray($r['state'] ?? null, 'Yasal hamlede uygulanmış state dönmedi.');
    }

    public function test_move_with_unrolled_die_rejected(): void
    {
        // Zar [3,1] ama 6 pip'lik hamle (23->17) -> atılmayan zar, yasadışı olmalı.
        $r = $this->validator->validate($this->opening([3, 1]), [
            ['from' => 23, 'to' => 17, 'die' => 6],
        ]);
        $this->assertEmpty($r['unreachable'] ?? null, 'Validator erişilemez.');
        $this->assertFalse((bool) ($r['valid'] ?? false), 'Atılmayan zarla hamle KABUL edildi (validator hatalı).');
    }

    public function test_move_from_empty_point_rejected(): void
    {
        // Index 1'de beyaz taş YOK (siyah index 0'da). Oradan hamle yasadışı olmalı.
        $r = $this->validator->validate($this->opening([3, 1]), [
            ['from' => 1, 'to' => 0, 'die' => 1],
        ]);
        $this->assertEmpty($r['unreachable'] ?? null, 'Validator erişilemez.');
        $this->assertFalse((bool) ($r['valid'] ?? false), 'Boş noktadan hamle KABUL edildi (validator hatalı).');
    }

    public function test_legal_moves_endpoint_returns_nonempty(): void
    {
        // Açılışta [6,5] için legal-moves boş olamaz (lover's leap dahil hamleler var).
        $moves = $this->validator->legalMoves($this->opening([6, 5]));
        $this->assertIsArray($moves, 'legal-moves erişilemez/null döndü.');
        $this->assertNotEmpty($moves, 'Açılış [6,5] için legal-moves boş döndü (validator hatalı).');
    }
}
