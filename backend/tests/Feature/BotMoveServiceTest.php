<?php

namespace Tests\Feature;

use App\Services\BotMoveService;
use App\Services\BotUnavailableException;
use App\Support\Backgammon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * BotMoveService: gnubg sıralamasını validator'ın DOĞRU-die'li yasal hamleleriyle SONUÇ-TAHTASI
 * üzerinden eşler. gnubg (Http) + validator (Http) taklit edilerek eşleme + seviye seçimi + duraklama
 * sınanır.
 */
class BotMoveServiceTest extends TestCase
{
    private array $moveA = [['from' => 11, 'to' => 8, 'die' => 3], ['from' => 5, 'to' => 4, 'die' => 1]];

    private array $moveB = [['from' => 23, 'to' => 20, 'die' => 3], ['from' => 20, 'to' => 19, 'die' => 1]];

    private function state(): array
    {
        $s = Backgammon::initialState();
        $s['dice'] = [3, 1];
        $s['diceUsed'] = [false, false];

        return $s;
    }

    /** gnubg adayı: notasyondan türetilmiş from/to (die=0) — python /analyze'in ürettiği biçim. */
    private function gnubgSteps(array $steps): array
    {
        return array_map(fn ($s) => ['from' => $s['from'], 'to' => $s['to'], 'die' => 0], $steps);
    }

    private function service(): BotMoveService
    {
        config()->set('validator.url', 'http://validator.test');
        config()->set('gnubg.url', 'http://gnubg.test');

        return app(BotMoveService::class);
    }

    public function test_matches_gnubg_best_to_legal_move_with_correct_dice(): void
    {
        Http::fake([
            'validator.test/legal-moves' => Http::response(['moves' => [
                ['steps' => $this->moveA, 'resultKey' => 'A'],
                ['steps' => $this->moveB, 'resultKey' => 'B'],
            ]]),
            // gnubg en iyi = moveB (ilk), sonra moveA. steps die=0 (notasyondan).
            'gnubg.test/analyze' => Http::response(['result' => ['hint' => [
                ['move' => '24/20 20/19', 'steps' => $this->gnubgSteps($this->moveB)],
                ['move' => '13/10 6/5', 'steps' => $this->gnubgSteps($this->moveA)],
            ]]]),
        ]);

        // Level 10 -> daima en iyi (gnubg #1 = moveB) AMA doğru die validator'dan gelir.
        $chosen = $this->service()->chooseSteps($this->state(), ['target' => 1, 'score' => ['white' => 0, 'black' => 0]], 10);

        $this->assertSame($this->moveB, $chosen); // die=3,1 (validator'dan), gnubg'nin die=0'ı DEĞİL
    }

    /**
     * KÖK NEDEN "seviye 10 bot ~32 PR": gnubg birleşik tek-taş hamlesini KOMPAKT yazar ("24/19" =
     * tek adım 23->19), motor ise her zarı ayrı adım üretir ("24/20 20/19" = iki adım). from/to
     * anahtarları eşleşmezdi -> gnubg #1 (en iyi) sessizce elenir, bot moveA'yı (daha kötü) oynardı;
     * ranked boş kalmadığı için fallback logu da yazılmazdı (fallback=0 iken PR yine şişerdi).
     * SONUÇ-TAHTASI eşleşmesiyle kompakt aday DOĞRU yasal hamleye (moveB, iki-adım/doğru-die) bağlanır.
     */
    public function test_matches_compact_combined_move_by_result_board(): void
    {
        // Temiz konum: 23'te koşucu (moveB), 11 ve 5'te moveA kaynakları; ara noktalar (20/8/4) boş
        // -> ara vuruş yok -> gnubg kompakt tek-adım yazar; sonuç tahtası iki-adımlı ile birebir.
        $points = array_fill(0, 24, 0);
        $points[23] = 1;
        $points[11] = 1;
        $points[5] = 1;
        $state = [
            'points' => $points,
            'bar' => ['white' => 0, 'black' => 0],
            'off' => ['white' => 0, 'black' => 0],
            'turn' => 'white',
            'dice' => [3, 1],
            'diceUsed' => [false, false],
        ];
        // gnubg #1 = KOMPAKT birleşik moveB (tek adım 23->19, "24/19"); #2 = moveA.
        $compactB = [['from' => 23, 'to' => 19, 'die' => 0]];
        Http::fake([
            'validator.test/legal-moves' => Http::response(['moves' => [
                ['steps' => $this->moveA, 'resultKey' => 'A'],
                ['steps' => $this->moveB, 'resultKey' => 'B'], // 23->20->19 (doğru die: 3,1)
            ]]),
            'gnubg.test/analyze' => Http::response(['result' => ['hint' => [
                ['move' => '24/19', 'steps' => $compactB],
                ['move' => '13/10 6/5', 'steps' => $this->gnubgSteps($this->moveA)],
            ]]]),
        ]);

        $chosen = $this->service()->chooseSteps($state, ['target' => 1, 'score' => ['white' => 0, 'black' => 0]], 10);
        // Kompakt gnubg #1, doğru-die'li iki-adımlı moveB'ye eşleşmeli (eski from/to'da moveA'ya düşerdi).
        $this->assertSame($this->moveB, $chosen);
    }

    public function test_single_legal_move_skips_gnubg(): void
    {
        Http::fake([
            'validator.test/legal-moves' => Http::response(['moves' => [
                ['steps' => $this->moveA, 'resultKey' => 'A'],
            ]]),
            'gnubg.test/analyze' => Http::response([], 500), // çağrılmamalı
        ]);

        $chosen = $this->service()->chooseSteps($this->state(), ['target' => 1], 10);
        $this->assertSame($this->moveA, $chosen);
    }

    public function test_no_legal_moves_returns_pass(): void
    {
        Http::fake(['validator.test/legal-moves' => Http::response(['moves' => []])]);

        $this->assertSame([], $this->service()->chooseSteps($this->state(), ['target' => 1], 10));
    }

    public function test_gnubg_unavailable_throws(): void
    {
        Http::fake([
            'validator.test/legal-moves' => Http::response(['moves' => [
                ['steps' => $this->moveA, 'resultKey' => 'A'],
                ['steps' => $this->moveB, 'resultKey' => 'B'],
            ]]),
            'gnubg.test/analyze' => Http::response([], 500), // gnubg down
        ]);

        $this->expectException(BotUnavailableException::class);
        $this->service()->chooseSteps($this->state(), ['target' => 1], 10);
    }

    public function test_validator_unreachable_throws(): void
    {
        Http::fake(['validator.test/legal-moves' => function () {
            throw new \Illuminate\Http\Client\ConnectionException('refused');
        }]);

        $this->expectException(BotUnavailableException::class);
        $this->service()->chooseSteps($this->state(), ['target' => 1], 10);
    }

    /**
     * REGRESYON: bot BARDA iken gnubg'ye gönderilen pozisyon `bar`'ı İÇERMELİ. Eksikse gnubg
     * bardaki taşı görmez -> bar-girişsiz adaylar önerir -> yasal (bar-girişli) hamlelere eşleşmez
     * -> legal[0] (en kötü) fallback'i devreye girer ("Seviye 10 bot barda saçmalıyor" kök nedeni).
     */
    public function test_position_sent_to_gnubg_includes_bar(): void
    {
        // Siyah barda (die 5 -> index 4), 14-point (index 10) taşları hedef.
        $entryHit = [['from' => 'bar', 'to' => 4, 'die' => 5], ['from' => 10, 'to' => 11, 'die' => 1]];
        $entryDeep = [['from' => 'bar', 'to' => 0, 'die' => 1], ['from' => 10, 'to' => 15, 'die' => 5]];
        Http::fake([
            'validator.test/legal-moves' => Http::response(['moves' => [
                ['steps' => $entryHit, 'resultKey' => 'H'],
                ['steps' => $entryDeep, 'resultKey' => 'D'],
            ]]),
            'gnubg.test/analyze' => Http::response(['result' => ['hint' => [
                ['move' => 'bar/20 14/13', 'steps' => $this->gnubgSteps($entryHit)],
                ['move' => 'bar/24 14/9', 'steps' => $this->gnubgSteps($entryDeep)],
            ]]]),
        ]);

        $s = Backgammon::initialState();
        $s['turn'] = 'black';
        $s['dice'] = [5, 1];
        $s['diceUsed'] = [false, false];
        $s['bar']['black'] = 1;

        $chosen = $this->service()->chooseSteps($s, ['target' => 1, 'score' => ['white' => 0, 'black' => 0]], 10);
        // gnubg #1 (bar/20 14/13) doğru-die'li yasal hamleyle eşleşmeli (bar gönderildiği için).
        $this->assertSame($entryHit, $chosen);

        Http::assertSent(function (\Illuminate\Http\Client\Request $req) {
            if (! str_contains($req->url(), 'gnubg.test/analyze')) {
                return false;
            }
            $body = $req->data();

            return isset($body['bar']) && (int) ($body['bar']['black'] ?? 0) === 1;
        });
    }
}
