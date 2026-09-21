<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Faz 2 â€” sunucu-otoriter KÃœP (doubling cube) + resign. KÃ¼p deÄŸeri/sahip/teklif SUNUCUDA;
 * istemci forge edemez. KÃ¼p motordan (hamle) baÄŸÄ±msÄ±z -> validator'a dokunmaz.
 */
class RoomCubeTest extends TestCase
{
    use RefreshDatabase;

    private ?User $p1 = null;
    private ?User $p2 = null;

    private function command(string $token, string $uri, array $payload = []): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs($token === 'p1' ? $this->p1 : $this->p2);
        return $this->postJson($uri, array_merge([
            'token' => $token,
            'command_id' => (string) Str::uuid(),
            'expected_version' => (int) Room::whereIn('code', ['CUBEX', 'LEGCY'])->first()->fresh()->server_version,
        ], $payload));
    }

    // target VARSAYILANI 7: kÃ¼p teklifleri iÃ§in canlÄ± (Ã¶lÃ¼ olmayan) bir maÃ§. turns=1 +
    // opened=true: aÃ§Ä±lÄ±ÅŸ eli oynandÄ± -> kÃ¼p hakkÄ± aÃ§Ä±k (gerÃ§ek kural: aÃ§Ä±lÄ±ÅŸtan Ã¶nce kÃ¼p yok).
    // score override edilebilir (Ã¶lÃ¼-kÃ¼p/Crawford skorlarÄ±nÄ± test etmek iÃ§in).
    private function room(int $target = 7, array $cube = ['value' => 1, 'owner' => null, 'pending' => null], array $stateOverride = [], array $matchOverride = []): Room
    {
        $this->p1 = User::factory()->create(['id' => 10]);
        $this->p2 = User::factory()->create(['id' => 20]);
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
            'mode' => 'friendly',
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
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')->assertOk();
        $this->assertSame('white', $this->cube(Room::first())['pending']);
    }

    public function test_offer_rejected_when_not_your_turn(): void
    {
        $this->room(); // turn=white
        $this->command('p2', '/api/rooms/CUBEX/cube/offer')->assertStatus(409);
    }

    public function test_offer_rejected_after_dice_rolled(): void
    {
        $this->room(stateOverride: ['dice' => [3, 1], 'diceUsed' => [false, false]]);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')->assertStatus(409);
    }

    public function test_offer_rejected_when_opponent_owns_cube(): void
    {
        $this->room(cube: ['value' => 2, 'owner' => 'black', 'pending' => null]);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')->assertStatus(409);
    }

    public function test_offer_allowed_when_you_own_cube(): void
    {
        $this->room(cube: ['value' => 2, 'owner' => 'white', 'pending' => null]);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')->assertOk();
        $this->assertSame('white', $this->cube(Room::first())['pending']);
    }

    // ---- teklif beklerken zar/hamle bloklu ----
    public function test_roll_blocked_while_cube_pending(): void
    {
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->command('p1', '/api/rooms/CUBEX/roll')->assertStatus(409);
    }

    // ---- yanÄ±t: take ----
    public function test_respond_take_doubles_and_transfers_cube(): void
    {
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->command('p2', '/api/rooms/CUBEX/cube/respond', ['action' => 'take'])
            ->assertOk()->assertJsonPath('action', 'take');
        $c = $this->cube(Room::first());
        $this->assertSame(2, $c['value']);
        $this->assertSame('black', $c['owner']); // take eden sahiplenir
        $this->assertNull($c['pending']);
    }

    // ---- yanÄ±t: drop ----
    public function test_respond_drop_awards_current_value_and_continues_match(): void
    {
        $this->room(target: 3, cube: ['value' => 2, 'owner' => 'white', 'pending' => 'white']);
        $this->command('p2', '/api/rooms/CUBEX/cube/respond', ['action' => 'drop'])
            ->assertOk()->assertJsonPath('winner', 'white')->assertJsonPath('match_done', false);
        $sm = Room::first()->fresh()->server_match;
        $this->assertSame(2, $sm['score']['white']); // drop = MEVCUT kÃ¼p deÄŸeri (gammon YOK)
        $this->assertSame(2, $sm['gameNo']);
        $this->assertSame(1, $sm['cube']['value']); // yeni oyun: kÃ¼p ortada
        $this->assertNull($sm['cube']['owner']);
    }

    public function test_respond_drop_can_win_match(): void
    {
        $this->room(target: 1, cube: ['value' => 1, 'owner' => null, 'pending' => 'black']);
        $this->command('p1', '/api/rooms/CUBEX/cube/respond', ['action' => 'drop'])
            ->assertOk()->assertJsonPath('winner', 'black')->assertJsonPath('match_done', true);
        $sm = Room::first()->fresh()->server_match;
        $this->assertTrue($sm['done']);
        $this->assertSame('black', $sm['winner']);
    }

    public function test_respond_rejected_from_offerer(): void
    {
        // Teklif eden kendi teklifini yanÄ±tlayamaz (yalnÄ±z rakip).
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->command('p1', '/api/rooms/CUBEX/cube/respond', ['action' => 'take'])->assertStatus(403);
    }

    public function test_respond_without_pending_syncs_gracefully(): void
    {
        // BEKLEYEN TEKLİF YOK: 409 YERİNE 200 not_turn (yarış/bayat cubePending). Küp DEĞİŞMEZ.
        $this->room();
        $this->command('p2', '/api/rooms/CUBEX/cube/respond', ['action' => 'take'])
            ->assertOk()->assertJsonPath('not_turn', true);
        $this->assertSame(1, (int) Room::first()->fresh()->server_match['cube']['value']); // küp aynı
    }

    // ---- move: kÃ¼p Ã§arpanÄ± ----
    public function test_move_applies_cube_multiplier_to_score(): void
    {
        config()->set('validator.url', 'http://validator.test');
        // KÃ¼p 2, zar atÄ±lmÄ±ÅŸ; beyaz 15 taÅŸ toplayÄ±p tek-puanlÄ±k maÃ§Ä± bitirecek -> 1(normal)Ã—2=2.
        $this->room(target: 1, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            stateOverride: ['dice' => [6, 1], 'diceUsed' => [false, false]]);

        $won = Backgammon::initialState();
        $won['off'] = ['white' => 15, 'black' => 5]; // kaybeden topladÄ± -> normal (1)
        $won['turn'] = 'black';
        $won['dice'] = [];
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $won])]);

        $this->command('p1', '/api/rooms/CUBEX/move', ['steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])
            ->assertOk()->assertJsonPath('match_done', true)->assertJsonPath('match.score.white', 2);
    }

    // ---- resign ----
    // SAF KONUM (kullanÄ±cÄ± kararÄ± 2026-09-16): pes eden ÅžU ANKÄ° konumundan deÄŸerlenir â€”
    // en az 1 taÅŸ topladÄ±ysa SINGLE (kÃ¼p Ã— 1). KÃ¼p 2 -> rakip +2. Konum Ã§arpanÄ± UYGULANIR.
    public function test_resign_awards_current_cube_value_single(): void
    {
        // Kaybeden (beyaz) en az 1 taÅŸ topladÄ± -> single (backgammon/gammon DEÄžÄ°L).
        $this->room(target: 3, cube: ['value' => 2, 'owner' => 'black', 'pending' => null],
            stateOverride: ['off' => ['white' => 1, 'black' => 0]]);
        $this->command('p1', '/api/rooms/CUBEX/resign')
            ->assertOk()->assertJsonPath('winner', 'black')->assertJsonPath('match_done', false);
        $this->assertSame(2, Room::first()->fresh()->server_match['score']['black']);
    }

    // SAF KONUM: pes deÄŸeri = kaybedenin konumu. Kaybeden hiÃ§ toplamadÄ± + bar/rakip-ev yok -> GAMMON (Ã—2).
    // (KazananÄ±n bear-off evresinde olmasÄ± ARANMAZ; siyahÄ±n off durumu deÄŸeri ETKÄ°LEMEZ.)
    public function test_resign_is_gammon_when_loser_has_no_borne_off_and_no_back_checker(): void
    {
        $gammonish = [
            'points' => array_fill(0, 24, 0),
            'bar' => ['white' => 0, 'black' => 0],
            'off' => ['white' => 0, 'black' => 0], // beyaz (kaybeden) hiÃ§ toplamadÄ±
            'turn' => 'white', 'dice' => [], 'diceUsed' => [],
        ];
        $gammonish['points'][8] = 15; // beyaz 15 taÅŸ ortada (gammon: hiÃ§ toplamadÄ±, bar/rakip-ev yok)
        $this->room(target: 5, cube: ['value' => 2, 'owner' => 'black', 'pending' => null], stateOverride: $gammonish);
        $this->command('p1', '/api/rooms/CUBEX/resign')->assertOk();
        $this->assertSame(4, Room::first()->fresh()->server_match['score']['black']); // kÃ¼p 2 Ã— 2 (gammon) = 4
    }

    // SAF KONUM: kaybedenin taÅŸÄ± KAZANANIN evinde -> BACKGAMMON (Ã—3). KazananÄ±n bear-off evresinde
    // olmasÄ± ARANMAZ (eski "hayalet backgammon" kalkanÄ± kaldÄ±rÄ±ldÄ±).
    public function test_resign_is_backgammon_when_loser_has_checker_in_winner_home(): void
    {
        $bg = [
            'points' => array_fill(0, 24, 0),
            'bar' => ['white' => 0, 'black' => 0],
            'off' => ['white' => 0, 'black' => 0],
            'turn' => 'white', 'dice' => [], 'diceUsed' => [],
        ];
        $bg['points'][8] = 14;  // beyaz 14 taÅŸ ortada
        $bg['points'][20] = 1;  // beyaz 1 taÅŸ siyahÄ±n evinde (18-23) -> backgammon
        $this->room(target: 9, cube: ['value' => 2, 'owner' => 'black', 'pending' => null], stateOverride: $bg);
        $this->command('p1', '/api/rooms/CUBEX/resign')->assertOk();
        $this->assertSame(6, Room::first()->fresh()->server_match['score']['black']); // kÃ¼p 2 Ã— 3 (backgammon) = 6
    }

    // ---- geriye uyum: authoritative olmayan odada kÃ¼p uÃ§larÄ± reddedilir ----
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
    // 18-SENARYO KÃœP DENETÄ°MÄ° (sunucu-otoriter enforce + net reason). Merkezi cubeAvailability.
    // ====================================================================================

    // (4,5,6,7,8,9,18) KÃ¼p deÄŸeri 1â†’2â†’4â†’8â†’16â†’32â†’64 ilerler; 64 tavanda daha fazla teklif edilemez.
    // Uzun maÃ§ (target=128) -> Ã¶lÃ¼-kÃ¼p devreye girmesin, saf Ã—2 matematiÄŸi + tavan izole test.
    public function test_cube_value_progression_1_to_64_and_max_cap(): void
    {
        $room = $this->room(target: 128);
        foreach ([1 => 2, 2 => 4, 4 => 8, 8 => 16, 16 => 32, 32 => 64] as $from => $to) {
            // KÃ¼pÃ¼ 'from' deÄŸerinde ORTAYA koy, sÄ±ra beyazda, zar boÅŸ -> beyaz teklif + siyah take.
            $sm = $room->fresh()->server_match;
            $sm['cube'] = ['value' => $from, 'owner' => null, 'pending' => null];
            $st = $room->fresh()->server_state;
            $st['turn'] = 'white';
            $st['dice'] = [];
            $r = $room->fresh();
            $r->server_match = $sm;
            $r->server_state = $st;
            $r->save();

            $this->command('p1', '/api/rooms/CUBEX/cube/offer')->assertOk();
            $this->command('p2', '/api/rooms/CUBEX/cube/respond', ['action' => 'take'])->assertOk();
            $this->assertSame($to, $this->cube($room->fresh())['value']);
            $this->assertSame('black', $this->cube($room->fresh())['owner']);
        }
        // KÃ¼p 64 tavanda: yeni teklif REDDEDÄ°LÄ°R (CUBE_AT_MAX). 128'e Ã§Ä±kÄ±lamaz.
        $r = $room->fresh();
        $sm = $r->server_match;
        $sm['cube'] = ['value' => 64, 'owner' => 'white', 'pending' => null];
        $st = $r->server_state;
        $st['turn'] = 'white';
        $st['dice'] = [];
        $r->server_match = $sm;
        $r->server_state = $st;
        $r->save();
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'CUBE_AT_MAX');
    }

    // (4) Redouble: take'ten sonra kÃ¼p alan tarafa (siyah) geÃ§er; KARÅžI taraf (beyaz) artÄ±k
    // teklif EDEMEZ (NOT_CUBE_OWNER). YalnÄ±z sahip redouble edebilir.
    public function test_redouble_only_by_cube_owner_after_take(): void
    {
        // KÃ¼p 2, sahip siyah (take etmiÅŸ gibi). SÄ±ra beyazda -> beyaz teklif edemez.
        $this->room(cube: ['value' => 2, 'owner' => 'black', 'pending' => null]);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'NOT_CUBE_OWNER');
        // SÄ±ra siyaha geÃ§ince (sahip) redouble edebilir.
        $r = Room::first();
        $st = $r->server_state;
        $st['turn'] = 'black';
        $r->server_state = $st;
        $r->save();
        $this->command('p2', '/api/rooms/CUBEX/cube/offer')->assertOk();
        $this->assertSame('black', $this->cube(Room::first())['pending']);
    }

    // (10) Crawford oyununda kÃ¼p teklifi REDDEDÄ°LÄ°R (CRAWFORD_GAME) + reason gÃ¶vdede.
    public function test_offer_rejected_in_crawford_game(): void
    {
        $this->room(target: 5, matchOverride: ['crawford' => true, 'score' => ['white' => 4, 'black' => 2]]);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'CRAWFORD_GAME');
    }

    // (11) Post-Crawford: Crawford oyunu bittiyse (crawfordDone) kÃ¼p yeniden AKTÄ°F.
    public function test_offer_allowed_post_crawford(): void
    {
        // Siyah 5 puan uzakta (score black=0, target=5) -> onun iÃ§in kÃ¼p canlÄ±; sÄ±ra siyahta.
        $this->room(target: 5, matchOverride: [
            'crawford' => false, 'crawfordDone' => true, 'score' => ['white' => 4, 'black' => 0],
        ], stateOverride: ['turn' => 'black']);
        $this->command('p2', '/api/rooms/CUBEX/cube/offer')->assertOk();
        $this->assertSame('black', $this->cube(Room::first())['pending']);
    }

    // (12) Ã–lÃ¼ kÃ¼p: 5'lik maÃ§ta 4-3, Ã¶nde olan (beyaz, 1 puan uzakta) kÃ¼pÃ¼ teklif EDEMEZ
    // (kazanmak zaten maÃ§Ä± bitirir -> DEAD_CUBE). Skordan baÄŸÄ±msÄ±z genel hesap: value>=need.
    public function test_offer_rejected_dead_cube_score(): void
    {
        $this->room(target: 5, matchOverride: ['score' => ['white' => 4, 'black' => 3]]);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'DEAD_CUBE');
        // Geride olan (siyah, 2 puan uzakta) iÃ§in kÃ¼p CANLI (value 1 < need 2); sÄ±ra siyaha geÃ§ince.
        $r = Room::first();
        $st = $r->server_state;
        $st['turn'] = 'black';
        $r->server_state = $st;
        $r->save();
        $this->command('p2', '/api/rooms/CUBEX/cube/offer')->assertOk();
    }

    // Ã–lÃ¼ kÃ¼p genel: value=2, beyaza 2 kaldÄ± -> DEAD_CUBE (5'lik, 3-x). value>=need genel kuralÄ±.
    public function test_offer_rejected_dead_cube_when_value_covers_need(): void
    {
        $this->room(target: 5, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            matchOverride: ['score' => ['white' => 3, 'black' => 0]]);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'DEAD_CUBE');
    }

    // 1 puanlÄ±k maÃ§: kÃ¼p HÄ°Ã‡ kullanÄ±lmaz (ONE_POINT_MATCH).
    public function test_offer_rejected_one_point_match(): void
    {
        $this->room(target: 1);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'ONE_POINT_MATCH');
    }

    // AÃ§Ä±lÄ±ÅŸ eli oynanmadan (turns=0) kÃ¼p teklif edilemez (OPENING_NOT_PLAYED).
    public function test_offer_rejected_before_opening(): void
    {
        $this->room(matchOverride: ['turns' => 0]);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'OPENING_NOT_PLAYED');
    }

    // (17) Bekleyen teklif varken Ä°KÄ°NCÄ° teklif reddedilir (DOUBLE_ALREADY_PENDING).
    public function test_second_offer_while_pending_rejected(): void
    {
        $this->room(cube: ['value' => 1, 'owner' => null, 'pending' => 'white']);
        $this->command('p1', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'DOUBLE_ALREADY_PENDING');
    }

    // (16) SÄ±ra rakipteyken teklif reddedilir (NOT_PLAYERS_TURN) + reason gÃ¶vdede.
    public function test_offer_rejected_not_your_turn_reason(): void
    {
        $this->room(); // turn=white
        $this->command('p2', '/api/rooms/CUBEX/cube/offer')
            ->assertStatus(409)->assertJsonPath('reason', 'NOT_PLAYERS_TURN');
    }

    // (13) Gammon + kÃ¼p: oyunu gammon biten taraf kÃ¼p Ã— 2 alÄ±r (kaybeden hiÃ§ toplamadÄ±).
    public function test_move_gammon_times_cube(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 7, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            stateOverride: ['dice' => [6, 1], 'diceUsed' => [false, false]]);
        // Kazanan beyaz 15 topladÄ±; siyah (kaybeden) hiÃ§ toplamadÄ±, beyazÄ±n evinde/bar'da YOK -> gammon.
        $won = Backgammon::initialState();
        $won['points'] = array_fill(0, 24, 0);
        $won['points'][10] = -15; // siyah orta bÃ¶lgede (beyazÄ±n evi 0-5 DIÅžI) -> gammon, backgammon deÄŸil
        $won['off'] = ['white' => 15, 'black' => 0];
        $won['bar'] = ['white' => 0, 'black' => 0];
        $won['turn'] = 'black';
        $won['dice'] = [];
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $won])]);

        $this->command('p1', '/api/rooms/CUBEX/move', ['steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])
            ->assertOk()->assertJsonPath('match.score.white', 4); // gammon(2) Ã— kÃ¼p(2) = 4
    }

    // (14) Backgammon + kÃ¼p: kaybedenin bar'da taÅŸÄ± var -> kÃ¼p Ã— 3.
    public function test_move_backgammon_times_cube(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 7, cube: ['value' => 2, 'owner' => 'white', 'pending' => null],
            stateOverride: ['dice' => [6, 1], 'diceUsed' => [false, false]]);
        $won = Backgammon::initialState();
        $won['points'] = array_fill(0, 24, 0);
        $won['points'][10] = -14;
        $won['off'] = ['white' => 15, 'black' => 0];
        $won['bar'] = ['white' => 0, 'black' => 1]; // siyah bar'da -> backgammon (3Ã—)
        $won['turn'] = 'black';
        $won['dice'] = [];
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $won])]);

        $this->command('p1', '/api/rooms/CUBEX/move', ['steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])
            ->assertOk()->assertJsonPath('match.score.white', 6); // backgammon(3) Ã— kÃ¼p(2) = 6
    }

    // (15) MaÃ§Ä±n PASS ile bitmesi: drop, teklif edeni MEVCUT kÃ¼p deÄŸerinde kazandÄ±rÄ±r (gammon YOK)
    // -> zaten test_respond_drop_* kapsÄ±yor. Burada: 5'lik maÃ§ta kÃ¼p 2 drop -> beyaz +2, maÃ§ sÃ¼rer.
    public function test_pass_awards_current_cube_value_no_gammon(): void
    {
        $this->room(target: 5, cube: ['value' => 2, 'owner' => 'white', 'pending' => 'white']);
        $this->command('p2', '/api/rooms/CUBEX/cube/respond', ['action' => 'drop'])
            ->assertOk()->assertJsonPath('winner', 'white')->assertJsonPath('match_done', false);
        $this->assertSame(2, Room::first()->fresh()->server_match['score']['white']); // MEVCUT kÃ¼p = 2 (Ã—1)
    }

    // (16) REGRESYON: yÃ¼zde bahis maÃ§Ä±nda server_match matchmaking'de pct_stake_snapshot ile Ã¶n
    // tohumlanÄ±r (target/score/cube YOK). Ä°lk roll (aÃ§Ä±lÄ±ÅŸ) bu kÄ±smÄ± maÃ§ durumunu NORMALÄ°ZE etmeli:
    // aksi halde server_match.target null kalÄ±r -> kÃ¼p "Tek puanlÄ±k maÃ§" (409) reddi + iki istemci
    // FARKLI uzunluk gÃ¶sterir. AÃ§Ä±lÄ±ÅŸ sonrasÄ± target=3 (oda uzunluÄŸu) + pct snapshot KORUNMALÄ±.
    public function test_roll_initializes_match_over_pct_seeded_server_match(): void
    {
        $this->p1 = User::factory()->create(['id' => 10]);
        $this->p2 = User::factory()->create(['id' => 20]);
        $room = Room::create([
            'code' => 'PCTMM',
            'p1_token' => 'p1', 'p1_name' => 'A', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 0, 'target' => 3,
            'mode' => 'ranked', 'bet_pct' => 10, 'authoritative' => true,
            'server_state' => null,
            // matchmaking'in bÄ±raktÄ±ÄŸÄ± KISMÄ° durum: yalnÄ±z pct snapshot, target/score/cube YOK.
            'server_match' => ['pct_stake_snapshot' => ['10' => 50, '20' => 50]],
        ]);

        Sanctum::actingAs($this->p1);
        $this->postJson('/api/rooms/PCTMM/roll', [
            'token' => 'p1', 'command_id' => (string) Str::uuid(), 'expected_version' => 0,
        ])->assertOk()->assertJsonPath('opening', true);

        $sm = $room->fresh()->server_match;
        $this->assertSame(3, (int) ($sm['target'] ?? 0)); // oda uzunluÄŸundan normalize edildi
        $this->assertSame(['white' => 0, 'black' => 0], $sm['score']); // maÃ§ durumu tam kuruldu
        $this->assertSame(1, (int) $sm['cube']['value']);
        $this->assertSame(['10' => 50, '20' => 50], $sm['pct_stake_snapshot']); // pct snapshot KORUNDU
    }

    // (17) #5PTWV SUNUCU YARISI: kazanan kup 4'te GAMMON ile bitirir -> 5'lik macta skor 8 -> mac
    // biter (done=true). Bundan SONRA kaybedenin (bayat) cube/respond'u "Oyun aktif degil" 409 alir
    // -> tam da canlida gorulen 409. (Istemci tarafi: poll done'i mid-move'a ragmen uygular -> authSync
    // vitest kapsar; burada SUNUCUNUN dogru bitirdigini + gec aksiyonu reddettigini kanitlariz.)
    public function test_match_end_gammon_at_cube_four_then_late_cube_respond_409(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 5, cube: ['value' => 4, 'owner' => 'white', 'pending' => null],
            stateOverride: ['dice' => [6, 1], 'diceUsed' => [false, false]]);
        $won = Backgammon::initialState();
        $won['points'] = array_fill(0, 24, 0);
        $won['points'][10] = -14;              // siyah 14 tas ortada (gammon: hic toplamadi)
        $won['off'] = ['white' => 15, 'black' => 0];
        $won['bar'] = ['white' => 0, 'black' => 0];
        $won['turn'] = 'black';
        $won['dice'] = [];
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $won])]);

        // Beyaz son tasi toplar -> gammon(2) x kup(4) = 8 >= 5 -> mac biter.
        $this->command('p1', '/api/rooms/CUBEX/move', ['steps' => [['from' => 5, 'to' => 'off', 'die' => 6]]])
            ->assertOk()
            ->assertJsonPath('match.score.white', 8)
            ->assertJsonPath('match.done', true);

        $room = Room::first()->fresh();
        $this->assertTrue((bool) $room->server_match['done']);
        $this->assertSame('white', $room->server_match['winner']);
        $this->assertFalse($room->acceptsGameActions()); // done -> aksiyon kabul etmez

        // KAYBEDEN (siyah/p2) gec kalmis cube/respond gonderir -> 409 "Oyun aktif degil".
        $this->command('p2', '/api/rooms/CUBEX/cube/respond', ['action' => 'take'])
            ->assertStatus(409);
    }
}

