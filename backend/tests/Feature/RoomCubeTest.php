<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Faz 2 — sunucu-otoriter KÜP (doubling cube) + resign. Küp değeri/sahip/teklif SUNUCUDA;
 * istemci forge edemez. Küp motordan (hamle) bağımsız -> validator'a dokunmaz.
 */
class RoomCubeTest extends TestCase
{
    use RefreshDatabase;

    // target VARSAYILANI 7: küp teklifleri için canlı (ölü olmayan) bir maç. turns=1 +
    // opened=true: açılış eli oynandı -> küp hakkı açık (gerçek kural: açılıştan önce küp yok).
    // score override edilebilir (ölü-küp/Crawford skorlarını test etmek için).
    private function room(int $target = 7, array $cube = ['value' => 1, 'owner' => null, 'pending' => null], array $stateOverride = [], array $matchOverride = []): Room
    {
        $state = array_merge(Backgammon::initialState(), $stateOverride); // turn=white, dice=[]
        $match = array_merge([
            'target' => $target, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1,
            'done' => false, 'winner' => null, 'cube' => $cube, 'opened' => true, 'turns' => 1,
            'crawford' => false, 'crawfordDone' => false,
        ], $matchOverride);

        return Room::create([
            'code' => 'CUBEX',
            'p1_token' => 'p1', 'p1_name' => 'A', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 0, 'target' => $target,
            'authoritative' => true,
            'server_state' => $state,
            'server_match' => $match,
        ]);
    }

    private function cube(Room $room): array
    {
        return $room->fresh()->server_match['cube'];
    }

    // ---- teklif ----
    public function test_offer_sets_pending(): void
    {
        $this->room();
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertOk();
        $this->assertSame('white', $this->cube(Room::first())['pending']);
    }

    public function test_offer_rejected_when_not_your_turn(): void
    {
        $this->room(); // turn=white
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p2'])->assertStatus(409);
    }

    public function test_offer_rejected_after_dice_rolled(): void
    {
        $this->room(stateOverride: ['dice' => [3, 1], 'diceUsed' => [false, false]]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertStatus(409);
    }

    public function test_offer_rejected_when_opponent_owns_cube(): void
    {
        $this->room(cube: ['value' => 2, 'owner' => 'black', 'pending' => null]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertStatus(409);
    }

    public function test_offer_allowed_when_you_own_cube(): void
    {
        $this->room(cube: ['value' => 2, 'owner' => 'white', 'pending' => null]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertOk();
        $this->assertSame('white', $this->cube(Room::first())['pending']);
    }

    // ---- teklif beklerken zar/hamle bloklu ----
    public function test_roll_blocked_while_cube_pending(): void
    {
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/roll', ['token' => 'p1'])->assertStatus(409);
    }

    // ---- yanıt: take ----
    public function test_respond_take_doubles_and_transfers_cube(): void
    {
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p2', 'action' => 'take'])
            ->assertOk()->assertJsonPath('action', 'take');
        $c = $this->cube(Room::first());
        $this->assertSame(2, $c['value']);
        $this->assertSame('black', $c['owner']); // take eden sahiplenir
        $this->assertNull($c['pending']);
    }

    // ---- yanıt: drop ----
    public function test_respond_drop_awards_current_value_and_continues_match(): void
    {
        $this->room(target: 3, cube: ['value' => 2, 'owner' => 'white', 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p2', 'action' => 'drop'])
            ->assertOk()->assertJsonPath('winner', 'white')->assertJsonPath('match_done', false);
        $sm = Room::first()->fresh()->server_match;
        $this->assertSame(2, $sm['score']['white']); // drop = MEVCUT küp değeri (gammon YOK)
        $this->assertSame(2, $sm['gameNo']);
        $this->assertSame(1, $sm['cube']['value']); // yeni oyun: küp ortada
        $this->assertNull($sm['cube']['owner']);
    }

    public function test_respond_drop_can_win_match(): void
    {
        $this->room(target: 1, cube: ['value' => 1, 'owner' => null, 'pending' => 'black']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p1', 'action' => 'drop'])
            ->assertOk()->assertJsonPath('winner', 'black')->assertJsonPath('match_done', true);
        $sm = Room::first()->fresh()->server_match;
        $this->assertTrue($sm['done']);
        $this->assertSame('black', $sm['winner']);
    }

    public function test_respond_rejected_from_offerer(): void
    {
        // Teklif eden kendi teklifini yanıtlayamaz (yalnız rakip).
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p1', 'action' => 'take'])->assertStatus(403);
    }

    public function test_respond_rejected_without_pending(): void
    {
        $this->room();
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p2', 'action' => 'take'])->assertStatus(409);
    }

    // ---- move: küp çarpanı ----
    public function test_move_applies_cube_multiplier_to_score(): void
    {
        config()->set('validator.url', 'http://validator.test');
        // Küp 2, zar atılmış; beyaz 15 taş toplayıp tek-puanlık maçı bitirecek -> 1(normal)×2=2.
        $this->room(target: 1, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            stateOverride: ['dice' => [6, 1], 'diceUsed' => [false, false]]);

        $won = Backgammon::initialState();
        $won['off'] = ['white' => 15, 'black' => 5]; // kaybeden topladı -> normal (1)
        $won['turn'] = 'black';
        $won['dice'] = [];
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $won])]);

        $this->postJson('/api/rooms/CUBEX/move', ['token' => 'p1', 'steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])
            ->assertOk()->assertJsonPath('match_done', true)->assertJsonPath('match.score.white', 2);
    }

    // ---- resign ----
    // Düz pes = TEK OYUN (küp değeri × 1). Küp 2 -> rakip +2. (Gerçek kural: gammon/backgammon
    // ancak bear-off'ta tanımlı; pes seviyesi anlaşmayla. Konum çarpanı UYGULANMAZ.)
    public function test_resign_awards_current_cube_value_single(): void
    {
        $this->room(target: 3, cube: ['value' => 2, 'owner' => 'black', 'pending' => null]);
        $this->postJson('/api/rooms/CUBEX/resign', ['token' => 'p1'])
            ->assertOk()->assertJsonPath('winner', 'black')->assertJsonPath('match_done', false);
        $this->assertSame(2, Room::first()->fresh()->server_match['score']['black']);
    }

    // Pes DAİMA single'dır: kaybeden hiç taş toplamamış (gammon-görünümlü) bir konumda bile
    // rakip yalnız küp × 1 alır (hayalet gammon/backgammon YOK).
    public function test_resign_is_always_single_even_in_gammon_looking_position(): void
    {
        $gammonish = [
            'points' => array_fill(0, 24, 0),
            'bar' => ['white' => 0, 'black' => 0],
            'off' => ['white' => 0, 'black' => 5], // siyah topluyor, beyaz hiç toplamadı
            'turn' => 'white', 'dice' => [], 'diceUsed' => [],
        ];
        $gammonish['points'][8] = 15; // beyaz 15 taş ortada
        $this->room(target: 5, cube: ['value' => 2, 'owner' => 'black', 'pending' => null], stateOverride: $gammonish);
        $this->postJson('/api/rooms/CUBEX/resign', ['token' => 'p1'])->assertOk();
        $this->assertSame(2, Room::first()->fresh()->server_match['score']['black']); // küp 2 × 1 = 2 (single)
    }

    // ---- geriye uyum: authoritative olmayan odada küp uçları reddedilir ----
    public function test_cube_endpoints_require_authoritative_room(): void
    {
        Room::create([
            'code' => 'LEGCY', 'p1_token' => 'p1', 'p1_name' => 'A', 'p2_token' => 'p2', 'p2_name' => 'B',
            'status' => 'playing', 'version' => 0, 'authoritative' => false,
        ]);
        $this->postJson('/api/rooms/LEGCY/cube/offer', ['token' => 'p1'])->assertStatus(409);
        $this->postJson('/api/rooms/LEGCY/resign', ['token' => 'p1'])->assertStatus(409);
    }

    // ====================================================================================
    // 18-SENARYO KÜP DENETİMİ (sunucu-otoriter enforce + net reason). Merkezi cubeAvailability.
    // ====================================================================================

    // (4,5,6,7,8,9,18) Küp değeri 1→2→4→8→16→32→64 ilerler; 64 tavanda daha fazla teklif edilemez.
    // Uzun maç (target=128) -> ölü-küp devreye girmesin, saf ×2 matematiği + tavan izole test.
    public function test_cube_value_progression_1_to_64_and_max_cap(): void
    {
        $room = $this->room(target: 128);
        foreach ([1 => 2, 2 => 4, 4 => 8, 8 => 16, 16 => 32, 32 => 64] as $from => $to) {
            // Küpü 'from' değerinde ORTAYA koy, sıra beyazda, zar boş -> beyaz teklif + siyah take.
            $sm = $room->fresh()->server_match;
            $sm['cube'] = ['value' => $from, 'owner' => null, 'pending' => null];
            $st = $room->fresh()->server_state;
            $st['turn'] = 'white';
            $st['dice'] = [];
            $r = $room->fresh();
            $r->server_match = $sm;
            $r->server_state = $st;
            $r->save();

            $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])->assertOk();
            $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p2', 'action' => 'take'])->assertOk();
            $this->assertSame($to, $this->cube($room->fresh())['value']);
            $this->assertSame('black', $this->cube($room->fresh())['owner']);
        }
        // Küp 64 tavanda: yeni teklif REDDEDİLİR (CUBE_AT_MAX). 128'e çıkılamaz.
        $r = $room->fresh();
        $sm = $r->server_match;
        $sm['cube'] = ['value' => 64, 'owner' => 'white', 'pending' => null];
        $st = $r->server_state;
        $st['turn'] = 'white';
        $st['dice'] = [];
        $r->server_match = $sm;
        $r->server_state = $st;
        $r->save();
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])
            ->assertStatus(409)->assertJsonPath('reason', 'CUBE_AT_MAX');
    }

    // (4) Redouble: take'ten sonra küp alan tarafa (siyah) geçer; KARŞI taraf (beyaz) artık
    // teklif EDEMEZ (NOT_CUBE_OWNER). Yalnız sahip redouble edebilir.
    public function test_redouble_only_by_cube_owner_after_take(): void
    {
        // Küp 2, sahip siyah (take etmiş gibi). Sıra beyazda -> beyaz teklif edemez.
        $this->room(cube: ['value' => 2, 'owner' => 'black', 'pending' => null]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])
            ->assertStatus(409)->assertJsonPath('reason', 'NOT_CUBE_OWNER');
        // Sıra siyaha geçince (sahip) redouble edebilir.
        $r = Room::first();
        $st = $r->server_state;
        $st['turn'] = 'black';
        $r->server_state = $st;
        $r->save();
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p2'])->assertOk();
        $this->assertSame('black', $this->cube(Room::first())['pending']);
    }

    // (10) Crawford oyununda küp teklifi REDDEDİLİR (CRAWFORD_GAME) + reason gövdede.
    public function test_offer_rejected_in_crawford_game(): void
    {
        $this->room(target: 5, matchOverride: ['crawford' => true, 'score' => ['white' => 4, 'black' => 2]]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])
            ->assertStatus(409)->assertJsonPath('reason', 'CRAWFORD_GAME');
    }

    // (11) Post-Crawford: Crawford oyunu bittiyse (crawfordDone) küp yeniden AKTİF.
    public function test_offer_allowed_post_crawford(): void
    {
        // Siyah 5 puan uzakta (score black=0, target=5) -> onun için küp canlı; sıra siyahta.
        $this->room(target: 5, matchOverride: [
            'crawford' => false, 'crawfordDone' => true, 'score' => ['white' => 4, 'black' => 0],
        ], stateOverride: ['turn' => 'black']);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p2'])->assertOk();
        $this->assertSame('black', $this->cube(Room::first())['pending']);
    }

    // (12) Ölü küp: 5'lik maçta 4-3, önde olan (beyaz, 1 puan uzakta) küpü teklif EDEMEZ
    // (kazanmak zaten maçı bitirir -> DEAD_CUBE). Skordan bağımsız genel hesap: value>=need.
    public function test_offer_rejected_dead_cube_score(): void
    {
        $this->room(target: 5, matchOverride: ['score' => ['white' => 4, 'black' => 3]]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])
            ->assertStatus(409)->assertJsonPath('reason', 'DEAD_CUBE');
        // Geride olan (siyah, 2 puan uzakta) için küp CANLI (value 1 < need 2); sıra siyaha geçince.
        $r = Room::first();
        $st = $r->server_state;
        $st['turn'] = 'black';
        $r->server_state = $st;
        $r->save();
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p2'])->assertOk();
    }

    // Ölü küp genel: value=2, beyaza 2 kaldı -> DEAD_CUBE (5'lik, 3-x). value>=need genel kuralı.
    public function test_offer_rejected_dead_cube_when_value_covers_need(): void
    {
        $this->room(target: 5, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            matchOverride: ['score' => ['white' => 3, 'black' => 0]]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])
            ->assertStatus(409)->assertJsonPath('reason', 'DEAD_CUBE');
    }

    // 1 puanlık maç: küp HİÇ kullanılmaz (ONE_POINT_MATCH).
    public function test_offer_rejected_one_point_match(): void
    {
        $this->room(target: 1);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])
            ->assertStatus(409)->assertJsonPath('reason', 'ONE_POINT_MATCH');
    }

    // Açılış eli oynanmadan (turns=0) küp teklif edilemez (OPENING_NOT_PLAYED).
    public function test_offer_rejected_before_opening(): void
    {
        $this->room(matchOverride: ['turns' => 0]);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])
            ->assertStatus(409)->assertJsonPath('reason', 'OPENING_NOT_PLAYED');
    }

    // (17) Bekleyen teklif varken İKİNCİ teklif reddedilir (DOUBLE_ALREADY_PENDING).
    public function test_second_offer_while_pending_rejected(): void
    {
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p1'])
            ->assertStatus(409)->assertJsonPath('reason', 'DOUBLE_ALREADY_PENDING');
    }

    // (16) Sıra rakipteyken teklif reddedilir (NOT_PLAYERS_TURN) + reason gövdede.
    public function test_offer_rejected_not_your_turn_reason(): void
    {
        $this->room(); // turn=white
        $this->postJson('/api/rooms/CUBEX/cube/offer', ['token' => 'p2'])
            ->assertStatus(409)->assertJsonPath('reason', 'NOT_PLAYERS_TURN');
    }

    // (13) Gammon + küp: oyunu gammon biten taraf küp × 2 alır (kaybeden hiç toplamadı).
    public function test_move_gammon_times_cube(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 7, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            stateOverride: ['dice' => [6, 1], 'diceUsed' => [false, false]]);
        // Kazanan beyaz 15 topladı; siyah (kaybeden) hiç toplamadı, beyazın evinde/bar'da YOK -> gammon.
        $won = Backgammon::initialState();
        $won['points'] = array_fill(0, 24, 0);
        $won['points'][10] = -15; // siyah orta bölgede (beyazın evi 0-5 DIŞI) -> gammon, backgammon değil
        $won['off'] = ['white' => 15, 'black' => 0];
        $won['bar'] = ['white' => 0, 'black' => 0];
        $won['turn'] = 'black';
        $won['dice'] = [];
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $won])]);

        $this->postJson('/api/rooms/CUBEX/move', ['token' => 'p1', 'steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])
            ->assertOk()->assertJsonPath('match.score.white', 4); // gammon(2) × küp(2) = 4
    }

    // (14) Backgammon + küp: kaybedenin bar'da taşı var -> küp × 3.
    public function test_move_backgammon_times_cube(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 7, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            stateOverride: ['dice' => [6, 1], 'diceUsed' => [false, false]]);
        $won = Backgammon::initialState();
        $won['points'] = array_fill(0, 24, 0);
        $won['points'][10] = -14;
        $won['off'] = ['white' => 15, 'black' => 0];
        $won['bar'] = ['white' => 0, 'black' => 1]; // siyah bar'da -> backgammon (3×)
        $won['turn'] = 'black';
        $won['dice'] = [];
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $won])]);

        $this->postJson('/api/rooms/CUBEX/move', ['token' => 'p1', 'steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])
            ->assertOk()->assertJsonPath('match.score.white', 6); // backgammon(3) × küp(2) = 6
    }

    // (15) Maçın PASS ile bitmesi: drop, teklif edeni MEVCUT küp değerinde kazandırır (gammon YOK)
    // -> zaten test_respond_drop_* kapsıyor. Burada: 5'lik maçta küp 2 drop -> beyaz +2, maç sürer.
    public function test_pass_awards_current_cube_value_no_gammon(): void
    {
        $this->room(target: 5, cube: ['value' => 2, 'owner' => 'white', 'pending' => 'white']);
        $this->postJson('/api/rooms/CUBEX/cube/respond', ['token' => 'p2', 'action' => 'drop'])
            ->assertOk()->assertJsonPath('winner', 'white')->assertJsonPath('match_done', false);
        $this->assertSame(2, Room::first()->fresh()->server_match['score']['white']); // MEVCUT küp = 2 (×1)
    }
}
