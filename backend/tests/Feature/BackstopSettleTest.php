<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Orphan ekonomik settlement yedeği + pctLockedCoins over-lock fix.
 *
 * Kök sorun: bahisli maç bitince settle YALNIZ istemci çağrısına bağlıydı -> istemci düşerse oda
 * settled=0 kalıp coin'i KALICI kilitliyordu (105 oda / 128 kullanıcı). matches:backstop-settle
 * bunları sunucudan kapatır. Ayrıca kilit artık kendi TAM stake'i değil min(kendi, rakip).
 */
class BackstopSettleTest extends TestCase
{
    use RefreshDatabase;

    private function pctRoom(User $a, User $b, ?string $winner, int $snapA, int $snapB, bool $settled = false): Room
    {
        return Room::create([
            'code' => 'BSS'.random_int(100, 999), 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $a->id, 'p2_user_id' => $b->id, 'p1_name' => 'A', 'p2_name' => 'B',
            'status' => 'finished', 'mode' => 'ranked', 'stake' => 0, 'bet_pct' => 10, 'settled' => $settled,
            'authoritative' => true, 'version' => 0, 'server_version' => 0,
            'server_match' => ['target' => 1, 'done' => true, 'winner' => $winner,
                'score' => ['white' => 1, 'black' => 0],
                'pct_stake_snapshot' => [(string) $a->id => $snapA, (string) $b->id => $snapB]],
        ]);
    }

    // OVER-LOCK FIX: asimetrik %-maçta kilit = min(kendi, rakip), kendi TAM stake'i DEĞİL.
    public function test_asymmetric_pct_lock_uses_min_of_both_stakes(): void
    {
        $rich = User::factory()->create(['coins' => 10000]);
        $poor = User::factory()->create(['coins' => 1000]);
        // snapshot: zengin 1000 bahis, fakir 100 bahis -> riskteki min = 100.
        $this->pctRoom($rich, $poor, 'black', 1000, 100); // zengin (beyaz) kaybetti, settle yok

        $w = app(WalletService::class);
        // ESKİ (hatalı) davranış 1000 kilitlerdi -> 9000; DOĞRU: min(1000,100)=100 -> 9900.
        $this->assertSame(9900, $w->spendable($rich->fresh()));
    }

    // BACKSTOP: bitmiş+settled=0 bahisli oda sunucudan settle edilir -> coin taşınır + kilit açılır.
    public function test_backstop_settles_orphaned_finished_pct_room(): void
    {
        Setting::put('commission_pct', '0'); // deterministik: komisyon yok
        $winner = User::factory()->create(['coins' => 1000]);
        $loser = User::factory()->create(['coins' => 500]);
        // winner = p1 (beyaz). snapshot: winner 1000, loser 300 -> transfer min = 300.
        $room = $this->pctRoom($winner, $loser, 'white', 1000, 300);
        Room::whereKey($room->id)->update(['updated_at' => now()->subMinutes(5)]); // grace'i geç

        // settle öncesi: kazananın coin'i kilitli (min(1000,300)=300), oda açık.
        $this->assertSame(700, app(WalletService::class)->spendable($winner->fresh()));

        $this->artisan('matches:backstop-settle', ['--minutes' => 2])->assertSuccessful();

        $room->refresh();
        $this->assertTrue((bool) $room->settled, 'oda settle edilmeli');
        $this->assertSame(1300, (int) $winner->fresh()->coins, 'kazanan min-stake (300) almalı');
        $this->assertSame(200, (int) $loser->fresh()->coins, 'kaybeden min-stake (300) ödemeli');
        // settled=true -> artık kilit yok.
        $this->assertSame(1300, app(WalletService::class)->spendable($winner->fresh()));
    }

    // Kazananı çözülemeyen (non-authoritative / no-winner) oda PENDING kalır, coin taşınmaz.
    public function test_backstop_leaves_undecided_room_pending(): void
    {
        $a = User::factory()->create(['coins' => 1000]);
        $b = User::factory()->create(['coins' => 1000]);
        $room = $this->pctRoom($a, $b, null, 300, 300); // winner yok -> pending
        Room::whereKey($room->id)->update(['updated_at' => now()->subMinutes(5)]);

        $this->artisan('matches:backstop-settle', ['--minutes' => 2])->assertSuccessful();

        $this->assertFalse((bool) $room->refresh()->settled, 'kazanansız oda settle EDİLMEMELİ');
        $this->assertSame(1000, (int) $a->fresh()->coins);
        $this->assertSame(1000, (int) $b->fresh()->coins);
    }
}
