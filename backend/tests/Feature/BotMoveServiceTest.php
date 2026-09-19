<?php

namespace Tests\Feature;

use App\Services\BotMoveService;
use App\Services\BotUnavailableException;
use App\Support\Backgammon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * BotMoveService: gnubg sıralamasını validator'ın DOĞRU-die'li yasal hamleleriyle from/to üzerinden
 * eşler. gnubg (Http) + validator (Http) taklit edilerek eşleme + seviye seçimi + duraklama sınanır.
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
}
