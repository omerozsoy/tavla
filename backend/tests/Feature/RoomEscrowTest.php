<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// REZERVASYON ESCROW: bahisli maç başında stake REZERVE edilir (coins düşmez). Harcama yolları
// kullanılabilir bakiyeye (coins - coins_reserved) bakar. Settle transfer + rezerv bırakır;
// abort/cleanup yalnız rezerv bırakır (coin ASLA kaybolmaz). Tüm yollar test edilir.
class RoomEscrowTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n, int $coins = 1000): User
    {
        $u = User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n, 'email' => $n.'@e.com', 'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins;
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    public function test_matchmaking_reserves_stake_for_both(): void
    {
        $a = $this->user('resA');
        $b = $this->user('resB');

        Sanctum::actingAs($a);
        $this->postJson('/api/matchmaking', ['token' => 'tokA', 'name' => 'resA', 'stake' => 100, 'targets' => [1]])
            ->assertOk()->assertJsonPath('matched', false); // A havuzda bekler

        Sanctum::actingAs($b);
        $this->postJson('/api/matchmaking', ['token' => 'tokB', 'name' => 'resB', 'stake' => 100, 'targets' => [1]])
            ->assertOk()->assertJsonPath('matched', true); // B eşleşir -> pairing rezerv

        // Coins DÜŞMEZ (1000), coins_reserved = stake (100), oda escrowed.
        $this->assertSame(1000, (int) $a->fresh()->coins);
        $this->assertSame(1000, (int) $b->fresh()->coins);
        $this->assertSame(100, (int) $a->fresh()->coins_reserved);
        $this->assertSame(100, (int) $b->fresh()->coins_reserved);
        $this->assertTrue((bool) Room::where('p1_user_id', $a->id)->orWhere('p2_user_id', $a->id)->value('escrowed'));
    }

    public function test_reserved_coins_block_new_staked_match(): void
    {
        // Kullanılabilir bakiye = coins - coins_reserved. Reserved yüzünden yeni bahis karşılanamaz.
        $a = $this->user('blkA', 100);
        User::where('id', $a->id)->update(['coins_reserved' => 100]); // tümü rezerve (available 0)

        Sanctum::actingAs($a->fresh()); // güncel coins_reserved ile
        $this->postJson('/api/matchmaking', ['token' => 'tokX', 'name' => 'blkA', 'stake' => 50, 'targets' => [1]])
            ->assertStatus(422); // available 0 < 50 -> Yetersiz coin
    }

    public function test_settle_releases_escrow_and_transfers(): void
    {
        $p1 = $this->user('setA', 100);
        $p2 = $this->user('setB', 100);
        User::where('id', $p1->id)->update(['coins_reserved' => 50]);
        User::where('id', $p2->id)->update(['coins_reserved' => 50]);
        Room::create([
            'code' => 'ESCR', 'p1_token' => 'tok1', 'p1_user_id' => $p1->id, 'p1_name' => 'setA',
            'p2_token' => 'tok2', 'p2_user_id' => $p2->id, 'p2_name' => 'setB',
            'status' => 'playing', 'stake' => 50, 'bet_pct' => 0, 'version' => 1, 'settled' => false,
            'escrowed' => true, 'authoritative' => true,
            'server_match' => ['done' => true, 'winner' => 'white'], // p1 kazandı
        ]);

        Sanctum::actingAs($p1);
        $this->postJson('/api/rooms/ESCR/settle', ['token' => 'tok1', 'won' => true])->assertOk();

        // Kazanan (p1): coins +50 = 150, reserved bırakıldı = 0. Kaybeden (p2): coins -50 = 50, reserved 0.
        $this->assertSame(150, (int) $p1->fresh()->coins);
        $this->assertSame(0, (int) $p1->fresh()->coins_reserved);
        $this->assertSame(50, (int) $p2->fresh()->coins);
        $this->assertSame(0, (int) $p2->fresh()->coins_reserved);
    }

    public function test_pct_match_blocks_shop_spending(): void
    {
        // %-bahis maçları escrow'suz -> oynanan % maçta coin harcaması (mağaza) KİLİTLİ (coin olsa bile).
        $u = $this->user('pctU', 1000);
        Room::create([
            'code' => 'PCTM', 'p1_token' => 't1', 'p1_user_id' => $u->id, 'p1_name' => 'pctU',
            'p2_token' => 't2', 'p2_user_id' => 999999, 'p2_name' => 'X',
            'status' => 'playing', 'stake' => 0, 'bet_pct' => 50, 'version' => 1, 'settled' => false,
        ]);
        Sanctum::actingAs($u->fresh());
        $this->postJson('/api/shop/buy', ['id' => 'frame.pulse'])->assertStatus(422); // % maçta -> kilit
    }

    public function test_pct_helper_only_matches_pct_not_fixed(): void
    {
        $up = $this->user('hp', 1000);
        Room::create([
            'code' => 'HP', 'p1_token' => 't1', 'p1_user_id' => $up->id, 'p1_name' => 'hp',
            'status' => 'playing', 'stake' => 0, 'bet_pct' => 50, 'version' => 1, 'settled' => false,
        ]);
        $this->assertTrue(Room::userInPctStakedPlaying($up->id));

        // Sabit-stake (bet_pct 0) -> false (sabit-stake rezervasyonla korunur, tam kilit değil).
        $uf = $this->user('hf', 1000);
        Room::create([
            'code' => 'HF', 'p1_token' => 't1', 'p1_user_id' => $uf->id, 'p1_name' => 'hf',
            'status' => 'playing', 'stake' => 100, 'bet_pct' => 0, 'version' => 1, 'settled' => false,
        ]);
        $this->assertFalse(Room::userInPctStakedPlaying($uf->id));
    }

    public function test_cleanup_releases_stranded_escrow_no_coin_loss(): void
    {
        // Terk edilmiş escrowed oda (>1 gün) silinirken rezerv BIRAKILIR -> coin kaybı YOK.
        $p1 = $this->user('clnA', 100);
        $p2 = $this->user('clnB', 100);
        User::where('id', $p1->id)->update(['coins_reserved' => 40]);
        User::where('id', $p2->id)->update(['coins_reserved' => 40]);
        Room::create([
            'code' => 'STAL', 'p1_token' => 't1', 'p1_user_id' => $p1->id, 'p1_name' => 'clnA',
            'p2_token' => 't2', 'p2_user_id' => $p2->id, 'p2_name' => 'clnB',
            'status' => 'playing', 'stake' => 40, 'bet_pct' => 0, 'version' => 1, 'settled' => false, 'escrowed' => true,
        ]);
        \Illuminate\Support\Facades\DB::table('rooms')->where('code', 'STAL')
            ->update(['updated_at' => now()->subDays(2)]); // bayat (raw -> Eloquent timestamp'i ezmesin)

        // cleanupStale bir matchmaking çağrısıyla tetiklenir (private). Üçüncü kullanıcı bahissiz arar.
        $c = $this->user('clnC', 0);
        Sanctum::actingAs($c);
        $this->postJson('/api/matchmaking', ['token' => 'tokC', 'name' => 'clnC', 'stake' => 0, 'targets' => [1]])->assertOk();

        // Bayat oda silindi + rezerv bırakıldı; coin hiç düşmediği için tam iade (coins 100, reserved 0).
        $this->assertNull(Room::where('code', 'STAL')->first());
        $this->assertSame(100, (int) $p1->fresh()->coins);
        $this->assertSame(0, (int) $p1->fresh()->coins_reserved);
        $this->assertSame(0, (int) $p2->fresh()->coins_reserved);
    }
}
