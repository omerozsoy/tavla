<?php

namespace Tests\Feature;

use App\Http\Controllers\RoomController;
use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * DÜELLO = SABİT STAKE (potsuz DEĞİL). Takımlılar arası düello artık düz coin stake'iyle oynanır.
 *
 * Kritik sözleşme: düello mode='friendly' AMA stake>0 -> settle coin TAŞIR (atlamaz). Küp maç
 * skorunu etkiler ama COİNİ ETKİLEMEZ: transfer DAİMA düz stake (küp çarpanı yok), escrow da ×1.
 */
class DuelStakeTest extends TestCase
{
    use RefreshDatabase;

    private function duelRoom(User $a, User $b, string $winner, int $stake, int $whiteScore): Room
    {
        // İki oyuncu da join'de stake'i rezerve etmiş (coins_reserved) + escrowed oda -> settle öncesi durum.
        return Room::create([
            'code' => 'DUE'.random_int(100, 999), 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $a->id, 'p2_user_id' => $b->id, 'p1_name' => 'A', 'p2_name' => 'B',
            'status' => 'finished', 'mode' => 'friendly', 'duel' => true, 'unrated' => true,
            'stake' => $stake, 'bet_pct' => 0, 'settled' => false, 'escrowed' => true,
            'authoritative' => true, 'version' => 0, 'server_version' => 0,
            'server_match' => ['target' => 1, 'done' => true, 'winner' => $winner,
                'score' => ['white' => $whiteScore, 'black' => 0]],
        ]);
    }

    // DÜZ STAKE + KÜP YOK SAYILIR: skor 3 (gammon+küp) olsa bile transfer = düz stake (25), 75 DEĞİL.
    // Para oyunu (Tek Oyun) olsa 25×3=75 öderdi; düello `! duel` guard'ıyla flat kalır.
    public function test_duel_settles_flat_stake_ignoring_cube(): void
    {
        Setting::put('commission_pct', '0'); // deterministik
        $winner = User::factory()->create(['coins' => 100, 'coins_reserved' => 25]);
        $loser = User::factory()->create(['coins' => 100, 'coins_reserved' => 25]);
        $room = $this->duelRoom($winner, $loser, 'white', 25, 3); // skor 3 ama flat 25 taşınmalı

        $out = app(RoomController::class)->settleRoom($room);

        $this->assertArrayHasKey('amount', $out, 'düello settle coin taşımalı (skip DEĞİL)');
        $this->assertSame(25, (int) $out['amount'], 'transfer düz stake (25) olmalı, küp×skor (75) DEĞİL');
        $this->assertSame(125, (int) $winner->fresh()->coins, 'kazanan +25 (flat)');
        $this->assertSame(75, (int) $loser->fresh()->coins, 'kaybeden −25 (flat)');
        $this->assertSame(0, (int) $winner->fresh()->coins_reserved, 'kazanan rezervi bırakılmalı');
        $this->assertSame(0, (int) $loser->fresh()->coins_reserved, 'kaybeden rezervi bırakılmalı');
        $this->assertTrue((bool) $room->fresh()->settled);
        // settled -> kilit yok: iki taraf da tam kullanılabilir.
        $this->assertSame(125, app(WalletService::class)->spendable($winner->fresh()));
    }

    // KOMİSYON: %5'te kazanan stake − komisyon alır (25 − 1 = 24), kaybeden tam 25 öder, fark ledger'a.
    public function test_duel_applies_commission(): void
    {
        Setting::put('commission_pct', '5');
        $winner = User::factory()->create(['coins' => 100, 'coins_reserved' => 25]);
        $loser = User::factory()->create(['coins' => 100, 'coins_reserved' => 25]);
        $room = $this->duelRoom($winner, $loser, 'white', 25, 1);

        app(RoomController::class)->settleRoom($room);

        $this->assertSame(124, (int) $winner->fresh()->coins, 'kazanan 25 − %5 komisyon (24) almalı');
        $this->assertSame(75, (int) $loser->fresh()->coins, 'kaybeden tam stake (25) ödemeli');
    }
}
