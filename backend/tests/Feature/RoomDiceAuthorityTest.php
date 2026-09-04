<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Services\FairDiceService;
use App\Support\SeededOpening;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BAĞIMSIZ Faz 1 (para maçı güvenliği): sunucu-otoriter ZAR — hamle/tahta/küp LEGACY.
 * Zar SUNUCUDA (commit-reveal) üretilir; update() istemcinin oynadığı zarı sunucunun
 * verdiğiyle eşleşmeye zorlar -> istemci zar DEĞERİNİ seçemez (6-6 hilesi kapanır).
 */
class RoomDiceAuthorityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Enforcement testleri: canlı varsayılan SHADOW (false) olsa da burada ZORLAMA'yı
        // doğruluyoruz -> açık başlat. Gölge testi ayrıca false'a çeker.
        config()->set('dice.enforce', true);
    }

    private function room(bool $diceAuthority = true, ?int $target = null): Room
    {
        return Room::create([
            'code' => 'DICEX',
            'p1_token' => 'p1', 'p1_name' => 'A', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 0, 'target' => $target,
            'dice_authority' => $diceAuthority,
            'authoritative' => false,
        ]);
    }

    // İstemci PUT state'i: turnStart.dice + turn + match.score (gameNo için).
    private function state(array $dice, string $turn, array $score = ['white' => 0, 'black' => 0]): array
    {
        return [
            'turnStart' => ['dice' => $dice, 'diceUsed' => array_map(fn () => false, $dice), 'turn' => $turn],
            'match' => ['score' => $score],
        ];
    }

    // diceBaseKey kopyası (test tarafı doğrulama).
    private function keyOf(array $d): string
    {
        $vals = array_map('intval', array_values($d));
        if (count(array_unique($vals)) === 1) {
            return $vals[0].'-'.$vals[0];
        }
        sort($vals);

        return $vals[0].'-'.$vals[count($vals) - 1];
    }

    // Verilen anahtarlardan FARKLI (sunucu eli + açılış eli olmayan) bir sahte zar seç.
    private function forgedNotIn(array $avoidKeys): array
    {
        foreach ([[6, 6, 6, 6], [1, 1, 1, 1], [6, 5], [1, 2], [3, 4], [2, 4], [6, 3]] as $c) {
            if (! in_array($this->keyOf($c), $avoidKeys, true)) {
                return $c;
            }
        }
        $this->fail('sahte zar seçilemedi');
    }

    // ---- SeededOpening: JS `seededOpening` byte-exact portu ----
    public function test_seeded_opening_matches_js_reference(): void
    {
        // Referanslar node ile üretildi (src/App.tsx seededOpening ile birebir).
        $this->assertSame([1, 2], SeededOpening::dice('ABCDE', 0));
        $this->assertSame([6, 4], SeededOpening::dice('ABCDE', 1));
        $this->assertSame([4, 5], SeededOpening::dice('ABCDE', 5));
        $this->assertSame([2, 5], SeededOpening::dice('XY7Q9', 0));
        $this->assertSame([3, 2], SeededOpening::dice('XY7Q9', 3));
        $this->assertSame([3, 1], SeededOpening::dice('7ZK2M', 2));
        $this->assertSame([4, 2], SeededOpening::dice('QQQQQ', 10));
    }

    public function test_seeded_opening_never_equal(): void
    {
        for ($g = 0; $g < 40; $g++) {
            [$w, $b] = SeededOpening::dice('DICEX', $g);
            $this->assertNotSame($w, $b, "gameNo $g açılışı berabere olmamalı");
        }
    }

    // ---- roll: deterministik + idempotent (peek-ahead engeli) ----
    public function test_roll_issues_deterministic_server_dice(): void
    {
        $room = $this->room();
        $res = $this->postJson('/api/rooms/DICEX/roll', ['token' => 'p1'])->assertOk();
        $res->assertJsonPath('index', 0)->assertJsonPath('reused', false);

        // Sunucu tohumundan HMAC ile birebir üretilmiş olmalı.
        $room->refresh();
        [$d1, $d2] = app(FairDiceService::class)->roll($room->dice_seed, (string) $room->dice_client_seed, 0);
        $expected = $d1 === $d2 ? [$d1, $d1, $d1, $d1] : [$d1, $d2];
        $this->assertSame($expected, $res->json('dice'));
        $this->assertNotNull($room->dice_commit);
        $this->assertSame(1, (int) $room->dice_roll_index);
        $this->assertSame(0, (int) $room->dice_consumed);
    }

    public function test_roll_idempotent_no_peek_ahead(): void
    {
        $this->room();
        $a = $this->postJson('/api/rooms/DICEX/roll', ['token' => 'p1'])->assertOk();
        // Tüketilmeden tekrar iste: AYNI zar döner (daha iyi değer seçilemez, ileri el peek yok).
        $b = $this->postJson('/api/rooms/DICEX/roll', ['token' => 'p1'])->assertOk();
        $b->assertJsonPath('reused', true);
        $this->assertSame($a->json('dice'), $b->json('dice'));
        $this->assertSame(0, $b->json('index'));
        $this->assertSame(1, (int) Room::where('code', 'DICEX')->value('dice_roll_index'));
    }

    // ---- update: zar eşleşme zorlaması ----
    public function test_update_accepts_server_issued_dice(): void
    {
        $this->room();
        $dice = $this->postJson('/api/rooms/DICEX/roll', ['token' => 'p1'])->json('dice');
        $this->putJson('/api/rooms/DICEX', ['token' => 'p1', 'state' => $this->state($dice, 'white')])
            ->assertOk();
    }

    public function test_update_rejects_forged_dice(): void
    {
        $room = $this->room();
        $dice = $this->postJson('/api/rooms/DICEX/roll', ['token' => 'p1'])->json('dice');
        $openingKey = $this->keyOf(SeededOpening::dice('DICEX', 0));
        $forged = $this->forgedNotIn([$this->keyOf($dice), $openingKey]);

        $this->putJson('/api/rooms/DICEX', ['token' => 'p1', 'state' => $this->state($forged, 'white')])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'dice-forgery');

        // State YAZILMADI (reddedildi) -> version artmadı.
        $this->assertSame(0, (int) $room->fresh()->version);
    }

    public function test_update_accepts_opening_dice_without_roll(): void
    {
        // Açılış eli serverRoll'dan GELMEZ (deterministik). Hiç roll yokken bile MUAF.
        $this->room();
        $opening = SeededOpening::dice('DICEX', 0);
        $this->putJson('/api/rooms/DICEX', ['token' => 'p1', 'state' => $this->state($opening, 'white')])
            ->assertOk();
    }

    public function test_empty_dice_state_allowed(): void
    {
        // Tur arası (zar atılmamış) PUT -> zar yok, eşleşme kontrolü atlanır.
        $this->room();
        $this->putJson('/api/rooms/DICEX', ['token' => 'p1', 'state' => $this->state([], 'white')])
            ->assertOk();
    }

    // ---- tüketim: tur rengi değişince sıradaki el üretilir ----
    public function test_consumption_advances_roll_index_on_turn_flip(): void
    {
        $room = $this->room();
        // p1 (white) index 0 aldı, oynadı.
        $d0 = $this->postJson('/api/rooms/DICEX/roll', ['token' => 'p1'])->json('dice');
        $this->putJson('/api/rooms/DICEX', ['token' => 'p1', 'state' => $this->state($d0, 'white')])->assertOk();
        // Sıra siyaha geçti (dice boş) -> açık el tüketilir.
        $this->putJson('/api/rooms/DICEX', ['token' => 'p1', 'state' => $this->state([], 'black')])->assertOk();
        $this->assertSame(1, (int) $room->fresh()->dice_consumed);

        // Siyah yeni el ister -> index 1 (tüketilen sayısı), taze değer.
        $r = $this->postJson('/api/rooms/DICEX/roll', ['token' => 'p2'])->assertOk();
        $r->assertJsonPath('index', 1)->assertJsonPath('reused', false);
        $room->refresh();
        [$d1, $d2] = app(FairDiceService::class)->roll($room->dice_seed, (string) $room->dice_client_seed, 1);
        $expected = $d1 === $d2 ? [$d1, $d1, $d1, $d1] : [$d1, $d2];
        $this->assertSame($expected, $r->json('dice'));
    }

    // ---- geriye uyum: dice_authority=false oda etkilenmez (legacy) ----
    public function test_legacy_room_not_enforced(): void
    {
        $this->room(diceAuthority: false);
        // Legacy odada zar serbest (istemci üretir) -> herhangi bir zar kabul edilir.
        $this->putJson('/api/rooms/DICEX', ['token' => 'p1', 'state' => $this->state([6, 6, 6, 6], 'white')])
            ->assertOk();
    }

    // ---- kill-switch: DICE_ENFORCE=false -> shadow (zar verilir, reddedilmez) ----
    public function test_enforce_off_is_shadow_mode(): void
    {
        config()->set('dice.enforce', false);
        $this->room();
        $dice = $this->postJson('/api/rooms/DICEX/roll', ['token' => 'p1'])->json('dice');
        $openingKey = $this->keyOf(SeededOpening::dice('DICEX', 0));
        $forged = $this->forgedNotIn([$this->keyOf($dice), $openingKey]);
        // enforce kapalı: sahte zar bile kabul (ama zar yine sunucuda üretildi/loglandı).
        $this->putJson('/api/rooms/DICEX', ['token' => 'p1', 'state' => $this->state($forged, 'white')])
            ->assertOk();
        $this->assertNotEmpty(Room::where('code', 'DICEX')->value('dice_rolls'));
    }

    public function test_roll_rejects_non_participant(): void
    {
        $this->room();
        $this->postJson('/api/rooms/DICEX/roll', ['token' => 'intruder'])->assertStatus(403);
    }
}
