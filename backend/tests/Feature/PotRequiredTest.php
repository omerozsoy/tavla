<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// POTSUZ MAÇ YASAK (kullanıcı direktifi 2026-11-02): insan-insan maçları yüzde bahisli (min %10) olmalı.
// Davet/play + kod-paylaşımlı oda yollarında p2 katılınca pct_stake_snapshot üretilir (settle dayanağı);
// yoksa settleRoom 409 PENDING'e düşerdi. Bot maçları muaf (ayrı akış).
class PotRequiredTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $tag, int $coins = 100000): User
    {
        $u = User::create([
            'first_name' => $tag, 'last_name' => 'T', 'country' => '',
            'nickname' => $tag.uniqid(), 'email' => uniqid().'@x.com',
            'password' => bcrypt('secret123'), 'rating' => 1500,
        ]);
        // email_verified_at + coins fillable DEĞİL -> forceFill.
        $u->forceFill(['email_verified_at' => now(), 'coins' => $coins])->save();

        return $u;
    }

    public function test_potsuz_matchmaking_reddedilir(): void
    {
        Sanctum::actingAs($this->user('mm'));
        $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'stakes' => [0], 'bet_pct' => 0, 'targets' => [1], 'time_control' => 'normal',
        ])->assertStatus(422);
    }

    public function test_davet_maci_pot_snapshot_uretir(): void
    {
        $from = $this->user('from');
        $to = $this->user('to');

        // Davet yüzde bahisle oluşturulur -> game_invites.bet_pct.
        Sanctum::actingAs($from);
        $code = $this->postJson("/api/friends/{$to->id}/invite", [
            'target' => 5, 'time_control' => 'normal', 'unrated' => true, 'bet_pct' => 10,
        ])->assertOk()->json('code');
        $this->assertSame(10, (int) DB::table('game_invites')->where('room_code', $code)->value('bet_pct'));

        // Davet eden odayı kurar (p1); henüz snapshot yok.
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p1-'.$code, 'name' => 'FROM', 'target' => 5])->assertOk();

        // Davetli kabul edip p2 olarak girer -> snapshot ÜRETİLİR.
        $inviteId = DB::table('game_invites')->where('room_code', $code)->value('id');
        Sanctum::actingAs($to);
        $this->postJson("/api/invites/{$inviteId}/respond", ['accept' => true])->assertOk();
        $this->postJson("/api/rooms/{$code}/enter", ['token' => 'p2-'.$code, 'name' => 'TO', 'target' => 5])->assertOk();

        $room = Room::where('code', $code)->firstOrFail();
        $this->assertSame(10, (int) $room->bet_pct, 'oda davet potunu almalı');
        $snap = $room->server_match['pct_stake_snapshot'] ?? null;
        $this->assertIsArray($snap, 'pct_stake_snapshot üretilmeli (settle dayanağı)');
        $this->assertSame(10000, (int) $snap[(string) $from->id], 'from = %10 of 100000');
        $this->assertSame(10000, (int) $snap[(string) $to->id], 'to = %10 of 100000');
    }

    public function test_potsuz_davet_yetersiz_coin_reddedilir(): void
    {
        $from = $this->user('poor', 0); // 0 coin -> bahisli davet atamaz
        $to = $this->user('rich');
        Sanctum::actingAs($from);
        $this->postJson("/api/friends/{$to->id}/invite", [
            'target' => 5, 'time_control' => 'normal', 'unrated' => true, 'bet_pct' => 10,
        ])->assertStatus(422);
    }
}
