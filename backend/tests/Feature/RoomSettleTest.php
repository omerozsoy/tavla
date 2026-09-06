<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Bahisli oda settle GUVENLIGI (C1): coin YALNIZCA SUNUCU-OTORITER sonuctan (server_match)
// transfer edilir. Legacy mutual-consent (istemci beyani) ile TRANSFER YOK -> iki-hesap collusion
// (kaybeden 'lost' + kazanan 'won' anlasmasi) engellenir. Sunucu sonucu yoksa odeme pending kalir.
class RoomSettleTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick, int $coins): User
    {
        $u = User::create([
            'first_name' => $nick,
            'last_name' => 'T',
            'country' => '',
            'nickname' => $nick,
            'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins;
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    private function makeRoom(User $p1, User $p2, int $stake): Room
    {
        return Room::create([
            'code' => 'TESTR',
            'p1_token' => 'tok1',
            'p1_user_id' => $p1->id,
            'p1_name' => $p1->nickname,
            'p2_token' => 'tok2',
            'p2_user_id' => $p2->id,
            'p2_name' => $p2->nickname,
            'status' => 'playing',
            'stake' => $stake,
            'bet_pct' => 0,
            'version' => 1,
            'settled' => false,
        ]);
    }

    public function test_single_sided_claim_does_not_transfer_coins(): void
    {
        $p1 = $this->makeUser('alice', 100);
        $p2 = $this->makeUser('bob', 100);
        $room = $this->makeRoom($p1, $p2, 50);

        // Yalnizca p1 "kazandim" der; p2 mutabakati yok -> pending, transfer YOK.
        $this->postJson("/api/rooms/{$room->code}/settle", ['token' => 'tok1', 'won' => true])
            ->assertOk()
            ->assertJson(['ok' => false, 'pending' => true]);

        $this->assertEquals(100, $p1->fresh()->coins);
        $this->assertEquals(100, $p2->fresh()->coins);
    }

    public function test_mutual_agreement_does_not_transfer_staked(): void
    {
        // GÜVENLİK (C1): BAHİSLİ maçta legacy mutual-consent ile coin TRANSFER EDİLMEZ. p1 'won' +
        // p2 'lost' beyan etse bile (collusion) sunucu-otoriter sonuç (server_match) olmadan ödeme
        // PENDING kalır. Böylece iki hesap anlaşıp coin aktaramaz.
        $p1 = $this->makeUser('carol', 100);
        $p2 = $this->makeUser('dave', 100);
        $room = $this->makeRoom($p1, $p2, 50); // authoritative değil, server_match yok

        $this->postJson("/api/rooms/{$room->code}/settle", ['token' => 'tok1', 'won' => true])->assertOk();
        $this->postJson("/api/rooms/{$room->code}/settle", ['token' => 'tok2', 'won' => false])
            ->assertOk()
            ->assertJson(['ok' => false]); // transfer YOK

        $this->assertEquals(100, $p1->fresh()->coins);
        $this->assertEquals(100, $p2->fresh()->coins);
    }

    public function test_authoritative_settle_transfers_coins(): void
    {
        // Bahisli maçta coin YALNIZCA sunucu-otoriter sonuçtan (server_match done+winner) transfer
        // edilir — istemci mutabakatına gerek yok, forge edilemez.
        config(['game.commission_pct' => 0]); // saf transfer testi (komisyon ayrı testte, RoomEscrowTest)
        $p1 = $this->makeUser('carol', 100);
        $p2 = $this->makeUser('dave', 100);
        $room = Room::create([
            'code' => 'TESTA',
            'p1_token' => 'tok1', 'p1_user_id' => $p1->id, 'p1_name' => $p1->nickname,
            'p2_token' => 'tok2', 'p2_user_id' => $p2->id, 'p2_name' => $p2->nickname,
            'status' => 'playing', 'stake' => 50, 'bet_pct' => 0, 'version' => 1, 'settled' => false,
            'authoritative' => true,
            'server_match' => ['done' => true, 'winner' => 'white'], // p1 (beyaz) kazandı
        ]);

        // Tek settle çağrısı yeter: kazanan server_match'ten gelir.
        $this->postJson("/api/rooms/{$room->code}/settle", ['token' => 'tok1', 'won' => true])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->assertEquals(150, $p1->fresh()->coins);
        $this->assertEquals(50, $p2->fresh()->coins);
    }

    public function test_hard_error_uses_standard_message_shape(): void
    {
        $p1 = $this->makeUser('gary', 100);
        $p2 = $this->makeUser('hana', 100);
        $room = $this->makeRoom($p1, $p2, 50);

        // Odada olmayan token -> SERT HATA: 403 + {message} (fail() konvansiyonu).
        $this->postJson("/api/rooms/{$room->code}/settle", ['token' => 'intruder', 'won' => true])
            ->assertStatus(403)
            ->assertJsonStructure(['message']);
    }

    public function test_conflicting_claims_do_not_transfer(): void
    {
        $p1 = $this->makeUser('erin', 100);
        $p2 = $this->makeUser('finn', 100);
        $room = $this->makeRoom($p1, $p2, 50);

        // Ikisi de "kazandim" der -> celiski -> transfer YOK.
        $this->postJson("/api/rooms/{$room->code}/settle", ['token' => 'tok1', 'won' => true])->assertOk();
        $this->postJson("/api/rooms/{$room->code}/settle", ['token' => 'tok2', 'won' => true])
            ->assertOk()
            ->assertJson(['ok' => false]);

        $this->assertEquals(100, $p1->fresh()->coins);
        $this->assertEquals(100, $p2->fresh()->coins);
    }
}
