<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * UÇTAN UCA REGRESYON: yüzde-bahisli eşleşmede iki oyuncu FARKLI uzunluk seçer (biri [3],
 * diğeri [3,5,7,9,11]). Matchmaking ortak uzunlukların en yükseğinde (3) anlaşmalı; açılış
 * zarı atılınca server_match TAM kurulmalı (target/score/cube). Aksi halde (eski bug):
 *  - server_match yalnız pct_stake_snapshot ile ön-tohumlu kaldığından target YAZILMAZ,
 *  - küp teklifi "Tek puanlık maçta küp kullanılamaz" (ONE_POINT_MATCH 409) reddi alır,
 *  - iki istemci FARKLI uzunluk gösterir (11 vs 3).
 */
class MatchmakeCubeE2ETest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick, int $coins): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com', 'password' => bcrypt('secret123'),
        ]);
        $u->coins = $coins;
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    public function test_mismatched_length_pct_match_agrees_and_cube_is_not_one_point(): void
    {
        $a = $this->makeUser('alice', 100000);
        $b = $this->makeUser('bob', 100000);

        // B (bekleyen/p1): yüzde bahis + ÇOKLU uzunluk [3,5,7,9,11] -> havuza girer.
        Sanctum::actingAs($b);
        $this->postJson('/api/matchmaking', [
            'token' => 'B', 'name' => 'B', 'bet_pct' => 10,
            'targets' => [3, 5, 7, 9, 11], 'time_control' => 'normal',
        ])->assertOk()->assertJson(['matched' => false, 'slot' => 'p1']);

        // A (katılan/p2): yüzde bahis + TEK uzunluk [3] -> B ile eşleşir. Ortak = [3] -> target 3.
        Sanctum::actingAs($a);
        $res = $this->postJson('/api/matchmaking', [
            'token' => 'A', 'name' => 'A', 'bet_pct' => 10,
            'targets' => [3], 'time_control' => 'normal',
        ])->assertOk()
            ->assertJson(['matched' => true, 'slot' => 'p2'])
            ->assertJsonPath('room.target', 3); // İKİ istemci de aynı uzunluğu (3) alır

        $code = $res->json('room.code');
        $room = Room::where('code', $code)->firstOrFail();
        $this->assertTrue((bool) $room->authoritative, 'yüzde bahis -> sunucu-otoriter olmalı');
        // Ön koşul: matchmaking gerçekten pct_stake_snapshot ile ön-tohumladı (bug tetikleyicisi).
        $this->assertArrayHasKey('pct_stake_snapshot', (array) $room->server_match);
        $this->assertArrayNotHasKey('target', (array) $room->server_match); // henüz roll yok

        // p1 (B) açılış zarını atar -> server_match NORMALİZE edilmeli.
        Sanctum::actingAs($b);
        $roll = $this->postJson("/api/rooms/{$code}/roll", [
            'token' => 'B', 'command_id' => (string) Str::uuid(), 'expected_version' => 0,
        ])->assertOk()->assertJsonPath('opening', true);

        // ---- ROOT DÜZELTME KANITI: server_match TAM kuruldu, target = oda uzunluğu (3) ----
        $room->refresh();
        $sm = (array) $room->server_match;
        $this->assertSame(3, (int) ($sm['target'] ?? 0), 'server_match.target oda uzunluğundan (3) yazılmalı');
        $this->assertSame(['white' => 0, 'black' => 0], $sm['score']);
        $this->assertSame(1, (int) $sm['cube']['value']);
        $this->assertArrayHasKey('pct_stake_snapshot', $sm); // bahis anlık-görüntüsü KORUNDU
        $this->assertSame(3, (int) $room->toClient()['target']); // her iki istemciye giden değer 3

        // ---- KÜP: artık "Tek puanlık maç" (ONE_POINT_MATCH) DEĞİL ----
        // Açılış sonrası zar duruyor -> teklif başka bir nedenle reddedilebilir (DICE_ALREADY_ROLLED),
        // ama ASLA ONE_POINT_MATCH olmamalı (eski bug tam da buydu). Teklifi başlayan renkten yolla.
        $starter = $roll->json('starter'); // 'white'|'black'
        $offerToken = $starter === 'white' ? 'B' : 'A';
        Sanctum::actingAs($starter === 'white' ? $b : $a);
        $offer = $this->postJson("/api/rooms/{$code}/cube/offer", [
            'token' => $offerToken, 'command_id' => (string) Str::uuid(),
            'expected_version' => (int) $room->fresh()->server_version,
        ]);
        $reason = $offer->json('reason');
        $this->assertNotSame('ONE_POINT_MATCH', $reason, 'çok-puanlı maç yanlışlıkla tek-puan sayılmamalı');
    }
}
