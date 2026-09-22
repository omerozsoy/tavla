<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Services\BotMoveService;
use App\Services\BotUnavailableException;
use App\Services\MatchClock;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * SUNUCU-OTORİTER BOT (PvB): bot maçı artık istemci motoru değil authoritative Room. p2 = sunucu
 * botu. Bu testler: oda kurulumu + insan hamlesinden sonra botun SENKRON oynaması + gnubg yokken
 * DURAKLAMA (insan hamlesi korunur) + güvenlik (p2 slotu HTTP'den oynatılamaz). gnubg/validator
 * Http::fake ile taklit edilir; BotMoveService sahte bağlanır (gnubg lokalde yok).
 */
class BotRoomTest extends TestCase
{
    use RefreshDatabase;

    private function command(string $code, string $token, string $uri, array $payload = []): \Illuminate\Testing\TestResponse
    {
        $room = Room::where('code', $code)->first()->fresh();
        return $this->postJson($uri, array_merge([
            'token' => $token,
            'command_id' => (string) Str::uuid(),
            'expected_version' => (int) $room->server_version,
        ], $payload));
    }

    /** Belirli adımlar döndüren / istenirse fırlatan sahte bot. */
    private function fakeBot(array $steps = [], bool $throw = false): BotMoveService
    {
        $bot = new class extends BotMoveService
        {
            public array $ret = [];

            public bool $throw = false;

            public function __construct() {} // gnubg/validator bağımlılığı yok (sahte)

            public function chooseSteps(array $state, array $sm, int $level): array
            {
                if ($this->throw) {
                    throw new BotUnavailableException('test-unavailable');
                }

                return $this->ret;
            }
        };
        $bot->ret = $steps;
        $bot->throw = $throw;
        $this->app->instance(BotMoveService::class, $bot);

        return $bot;
    }

    /** Verilen renk sıradayken zarsız durum. */
    private function turnState(string $turn): array
    {
        $s = Backgammon::initialState();
        $s['turn'] = $turn;
        $s['dice'] = [];
        $s['diceUsed'] = [];

        return $s;
    }

    /** Siyah (bot) 15 taşı toplamış -> kazandı; sıra beyaza döndü. */
    private function blackWonState(): array
    {
        $s = Backgammon::initialState();
        $s['points'] = array_fill(0, 24, 0);
        // white 1 taş topladı -> normal (single) kazanç (gammon değil); black 15 -> kazandı.
        $s['off'] = ['white' => 1, 'black' => 15];
        $s['bar'] = ['white' => 0, 'black' => 0];
        $s['turn'] = 'white';
        $s['dice'] = [];
        $s['diceUsed'] = [];

        return $s;
    }

    /** Bot odası: p1=insan (beyaz), p2=bot (siyah), otoriter, açılış oynanmış, sıra + zar verilebilir. */
    private function botRoom(string $turn = 'white', array $dice = [3, 1]): Room
    {
        $state = Backgammon::initialState();
        $state['turn'] = $turn;
        $state['dice'] = $dice;
        $state['diceUsed'] = array_fill(0, count($dice), false);

        return Room::create([
            'code' => 'BOTAA',
            'p1_token' => 'human-tok',
            'p1_name' => 'İnsan',
            'p2_token' => 'secret-bot-token',
            'p2_name' => 'Seviye 10 · Neural AI',
            'status' => 'playing',
            'authoritative' => true,
            'dice_authority' => true,
            'bot' => true,
            'bot_level' => 10,
            'target' => 1,
            'version' => 0,
            'server_version' => 5,
            'server_state' => $state,
            'server_match' => [
                'target' => 1, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1,
                'done' => false, 'winner' => null,
                'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
                'crawford' => false, 'crawfordDone' => false, 'opened' => true, 'turns' => 1,
            ],
        ]);
    }

    public function test_create_bot_room_is_authoritative(): void
    {
        $res = $this->postJson('/api/bot/rooms', [
            'token' => 'human-tok', 'name' => 'İnsan', 'level' => 10, 'target' => 1,
        ])->assertOk();

        $res->assertJsonPath('slot', 'p1');
        $res->assertJsonPath('room.bot', true);
        $res->assertJsonPath('room.authoritative', true);
        $res->assertJsonPath('room.bot_level', 10);
        // Açılış oynanmadı (opened=false): istemcinin ilk serverRoll'unda roll() atar (online yolu).
        $this->assertSame(false, $res->json('room.server_match.opened'));

        $room = Room::first();
        $this->assertTrue($room->bot);
        $this->assertNotEmpty($room->p2_token);
        $this->assertNotSame('bot', $room->p2_token); // tahmin edilemez gizli token
        $this->assertStringContainsString('Neural AI', (string) $room->p2_name);
    }

    public function test_human_move_triggers_synchronous_bot_reply(): void
    {
        $this->fakeBot([['from' => 0, 'to' => 3, 'die' => 3]]); // botun (siyah) seçtiği tam-tur
        config()->set('validator.url', 'http://validator.test');

        // İnsan(beyaz) hamlesi -> siyah sırası; sonra bot hamlesi -> beyaz sırası.
        Http::fake(['validator.test/validate' => function ($request) {
            $turn = data_get($request->data(), 'state.turn');

            return Http::response(['valid' => true, 'state' => $this->turnState($turn === 'white' ? 'black' : 'white')]);
        }]);

        $this->botRoom('white', [3, 1]);

        $res = $this->command('BOTAA', 'human-tok', '/api/rooms/BOTAA/move', [
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertOk();

        // İnsan yanıtı KORUNUR (post-human: sıra black); bot turu ayrıca `bot[]`'te döner.
        $res->assertJsonPath('bot_status', 'played');
        $res->assertJsonPath('state.turn', 'black');       // insan hamlesi sonrası (bot henüz uygulanmadan)
        $res->assertJsonPath('bot.0.state.turn', 'white'); // botun turu -> sıra insana döndü
        $this->assertNotEmpty($res->json('bot.0.rollState')); // reconstruct için zar-atılmış tahta
        $this->assertNotEmpty($res->json('bot.0.dice'));

        $room = Room::where('code', 'BOTAA')->first();
        $this->assertSame('white', $room->server_state['turn']); // DB son durum: sıra insanda
        // Bot bir tur oynadı -> turns arttı (insan 1 + bot 1 = başlangıç 1'den >= 2).
        $this->assertGreaterThanOrEqual(2, (int) $room->server_match['turns']);
    }

    public function test_human_clock_gets_reveal_grace_after_bot_turn(): void
    {
        // KÖK FIX ("sıra bilgisayarda ama benim vaktim azalıyor", özellikle mobil): bot hamlesi
        // SUNUCUDA anında oynanıp sıra/saat aynı istekte insana (p1) döner; ama istemci botun
        // hamlesini reveal/animasyonla gösterip sonra oto-roll eder. graceHumanAfterBot bu reveal
        // süresini (BOT_REVEAL_GRACE) insanın segmentinin started_at'ını ileri iterek insana YAZMAZ.
        $this->fakeBot([['from' => 0, 'to' => 3, 'die' => 3]]);
        config()->set('validator.url', 'http://validator.test');
        Http::fake(['validator.test/validate' => function ($request) {
            $turn = data_get($request->data(), 'state.turn');

            return Http::response(['valid' => true, 'state' => $this->turnState($turn === 'white' ? 'black' : 'white')]);
        }]);

        $this->botRoom('white', [3, 1]);

        $this->command('BOTAA', 'human-tok', '/api/rooms/BOTAA/move', [
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertOk();

        $clock = Room::where('code', 'BOTAA')->first()->clock;
        $this->assertIsArray($clock);
        $this->assertSame('p1', $clock['turn_slot']); // bot oynadı -> sıra/saat insana (beyaz) döndü
        $this->assertTrue((bool) $clock['running']);

        // Mode'dan bağımsız: tam delay/banka değerlerini clock'tan oku.
        $fullDelay = (float) $clock['delay'];
        $fullBank = (float) $clock['p1_bank'];
        // Segment gerçek başlangıcı = started_at - grace (grace started_at'ı ileri itti).
        $segmentStart = (float) $clock['started_at'] - MatchClock::BOT_REVEAL_GRACE;

        // 1) started_at gerçekten ~grace kadar İLERİDE (reveal penceresi insana yazılmıyor).
        $this->assertGreaterThan(3.0, MatchClock::BOT_REVEAL_GRACE, 'grace anlamlı olmalı');

        // 2) Segment başlangıcından 2sn SONRA bile insanın delay sayacı TAM + bankası ERİMEMİŞ olmalı.
        $view2 = MatchClock::clientView($clock, $segmentStart + 2.0);
        $this->assertSame('white', $view2['active']); // sunucu sırayı insana verdi (bug'ın kaynağı)
        $this->assertEqualsWithDelta($fullDelay, $view2['delay'], 0.2, 'reveal-grace içinde delay düşmemeli');
        $this->assertEqualsWithDelta($fullBank, $view2['white'], 0.2, 'reveal-grace içinde insan bankası erimemeli');

        // 3) Grace bitince saat normal akmalı (kalıcı donma DEĞİL): grace+3sn'de delay belirgin düşük.
        $viewLater = MatchClock::clientView($clock, $segmentStart + MatchClock::BOT_REVEAL_GRACE + 3.0);
        $this->assertLessThan($fullDelay - 2.0, $viewLater['delay'], 'grace bitince delay normal akmalı');
    }

    public function test_bot_winning_move_finalizes_match(): void
    {
        $this->fakeBot([['from' => 5, 'to' => 'off', 'die' => 5]]); // botun kazanan hamlesi
        config()->set('validator.url', 'http://validator.test');

        // İnsan hamlesi -> siyah sırası; bot hamlesi -> SİYAH KAZANDI (off=15).
        Http::fake(['validator.test/validate' => function ($request) {
            $turn = data_get($request->data(), 'state.turn');

            return Http::response([
                'valid' => true,
                'state' => $turn === 'white' ? $this->turnState('black') : $this->blackWonState(),
            ]);
        }]);

        $this->botRoom('white', [3, 1]);

        $res = $this->command('BOTAA', 'human-tok', '/api/rooms/BOTAA/move', [
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertOk();

        // Üst düzey match_done = İNSAN hamlesi (kazanmadı=false); botun kazancı bot[0]'da.
        $res->assertJsonPath('bot.0.match_done', true);
        $res->assertJsonPath('bot.0.winner', 'black');

        $room = Room::where('code', 'BOTAA')->first();
        $this->assertTrue((bool) $room->server_match['done']);
        $this->assertSame('black', $room->server_match['winner']); // bot kazandı
        $this->assertSame(1, (int) $room->server_match['score']['black']); // 1-puanlık maç: single
    }

    public function test_gnubg_unavailable_pauses_but_preserves_human_move(): void
    {
        $this->fakeBot([], true); // gnubg yok -> chooseSteps fırlatır
        config()->set('validator.url', 'http://validator.test');
        // İnsan hamlesi -> siyah sırası (bu commit olur).
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $this->turnState('black')])]);

        $this->botRoom('white', [3, 1]);

        $res = $this->command('BOTAA', 'human-tok', '/api/rooms/BOTAA/move', [
            'steps' => [['from' => 11, 'to' => 8, 'die' => 3]],
        ])->assertOk();

        // Bot duraklatıldı ama insan hamlesi KAYDEDİLDİ (sıra siyahta = bot bekliyor).
        $res->assertJsonPath('bot_status', 'unavailable');
        $res->assertJsonPath('state.turn', 'black'); // insan hamlesi uygulandı, bot bekliyor
        $this->assertSame([], $res->json('bot'));     // bot oynayamadı

        $room = Room::where('code', 'BOTAA')->first();
        $this->assertSame('black', $room->server_state['turn']); // insan hamlesi geri alınmadı
    }

    public function test_bot_slot_cannot_be_played_via_http(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->botRoom('black', [3, 1]); // sıra botta

        // İstemci bot token'ıyla hamle etmeye çalışır -> 403 (bot yalnız sunucudan oynar).
        $this->postJson('/api/rooms/BOTAA/move', [
            'token' => 'secret-bot-token',
            'steps' => [['from' => 0, 'to' => 3, 'die' => 3]],
        ])->assertStatus(403);

        // Bot token'ıyla zar atmak da yasak.
        $this->postJson('/api/rooms/BOTAA/roll', ['token' => 'secret-bot-token'])->assertStatus(403);
    }

    public function test_bot_room_is_not_listed_in_live_matches(): void
    {
        // Bot maçı ÖZEL: Canlı Maçlar'da (spectate) görünmemeli.
        $this->postJson('/api/bot/rooms', [
            'token' => 'human-tok', 'name' => 'İnsan', 'level' => 5, 'target' => 1,
        ])->assertOk();
        $code = Room::first()->code;

        $res = $this->getJson('/api/live-matches')->assertOk();
        $codes = collect($res->json('matches') ?? $res->json('players') ?? [])->pluck('code')->all();
        $this->assertNotContains($code, $codes);
    }

    public function test_backstop_never_writes_rating_for_bot_room(): void
    {
        // Bot maçı terk/yenileme -> sunucu YEDEK satırı YAZMAMALI (haksız rating kaybı yok).
        $u = \App\Models\User::create([
            'first_name' => 'İnsan', 'last_name' => 'T', 'country' => '',
            'nickname' => 'insan', 'email' => 'insan@example.com', 'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(['rating' => 1500])->save();

        $room = Room::create([
            'code' => 'BOTZZ',
            'p1_token' => 'human-tok', 'p1_name' => 'İnsan', 'p1_user_id' => $u->id,
            'p2_token' => 'secret-bot', 'p2_name' => 'Seviye 10 · Neural AI',
            'status' => 'playing', 'authoritative' => true, 'bot' => true, 'bot_level' => 10, 'target' => 1,
            'server_match' => [
                'target' => 1, 'score' => ['white' => 0, 'black' => 1], 'gameNo' => 2, 'done' => true,
                'winner' => 'black', 'cube' => ['value' => 1, 'owner' => null, 'pending' => null], 'opened' => true, 'turns' => 0,
            ],
        ]);

        $written = \App\Support\MatchBackstop::ensure($room->fresh());
        $this->assertSame(0, $written); // bot odası -> hiçbir satır yazılmaz
        $this->assertDatabaseMissing('match_results', ['room_code' => 'BOTZZ', 'user_id' => $u->id]);
        $this->assertSame(1500, (int) $u->fresh()->rating); // rating DEĞİŞMEDİ
    }

    public function test_bot_room_appears_in_my_active_rooms_for_resume(): void
    {
        // Devam eden bot maçı "Maça Dön" banner'ında (myActiveRooms) görünmeli + bot bayrağı taşımalı.
        $u = \App\Models\User::create([
            'first_name' => 'İnsan', 'last_name' => 'T', 'country' => '',
            'nickname' => 'insan2', 'email' => 'insan2@example.com', 'password' => bcrypt('secret123'),
        ]);
        Room::create([
            'code' => 'BOTYY',
            'p1_token' => 'human-tok', 'p1_name' => 'İnsan', 'p1_user_id' => $u->id,
            'p2_token' => 'secret-bot', 'p2_name' => 'Seviye 7 · Neural AI',
            'status' => 'playing', 'authoritative' => true, 'bot' => true, 'bot_level' => 7, 'target' => 1,
            'server_state' => Backgammon::initialState(),
            'server_match' => [
                'target' => 1, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1, 'done' => false,
                'winner' => null, 'cube' => ['value' => 1, 'owner' => null, 'pending' => null], 'opened' => true, 'turns' => 1,
            ],
            'clock' => ['p1_seen' => microtime(true), 'segment' => 'p1'], // taze -> canlı say
        ]);

        \Laravel\Sanctum\Sanctum::actingAs($u);
        $res = $this->getJson('/api/me/active-rooms')->assertOk();
        $row = collect($res->json('rooms'))->firstWhere('code', 'BOTYY');
        $this->assertNotNull($row);
        $this->assertTrue((bool) $row['bot']);
        $this->assertSame(7, (int) $row['bot_level']);
    }

    /** target=3 (küp açık), sıra verilen renkte, açılış oynanmış (turns=1), küp ortada. */
    private function cubeRoom(string $turn = 'white'): Room
    {
        $state = Backgammon::initialState();
        $state['turn'] = $turn;
        $state['dice'] = [];
        $state['diceUsed'] = [];

        return Room::create([
            'code' => 'BOTCU',
            'p1_token' => 'human-tok', 'p1_name' => 'İnsan',
            'p2_token' => 'secret-bot', 'p2_name' => 'Seviye 10 · Neural AI',
            'status' => 'playing', 'authoritative' => true, 'dice_authority' => true,
            'bot' => true, 'bot_level' => 10, 'target' => 3, 'version' => 0, 'server_version' => 3,
            'server_state' => $state,
            'server_match' => [
                'target' => 3, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1, 'done' => false,
                'winner' => null, 'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
                'crawford' => false, 'crawfordDone' => false, 'opened' => true, 'turns' => 1,
            ],
        ]);
    }

    public function test_bot_cube_response_uses_gnubg_take(): void
    {
        config()->set('gnubg.url', 'http://gnubg.test');
        Http::fake(['gnubg.test/analyze' => Http::response(['cube' => ['proper' => 'Double, take']])]);
        $this->cubeRoom('white'); // sıra insanda -> insan küp teklif eder

        $res = $this->command('BOTCU', 'human-tok', '/api/rooms/BOTCU/cube/offer')->assertOk();
        $res->assertJsonPath('bot_cube', 'take');
        $res->assertJsonPath('match.cube.value', 2);
        $res->assertJsonPath('match.cube.owner', 'black');
        $res->assertJsonPath('match.cube.pending', null);
    }

    public function test_bot_cube_response_uses_gnubg_drop(): void
    {
        config()->set('gnubg.url', 'http://gnubg.test');
        Http::fake(['gnubg.test/analyze' => Http::response(['cube' => ['proper' => 'Double, pass']])]);
        $this->cubeRoom('white');

        $res = $this->command('BOTCU', 'human-tok', '/api/rooms/BOTCU/cube/offer')->assertOk();
        $res->assertJsonPath('bot_cube', 'drop');
        $res->assertJsonPath('winner', 'white'); // bot pes -> insan mevcut küp değerinde (1) kazanır

        $room = Room::where('code', 'BOTCU')->first();
        $this->assertSame(1, (int) $room->server_match['score']['white']); // 1 puan (küp değeri)
    }

    public function test_bot_offers_double_via_gnubg(): void
    {
        config()->set('gnubg.url', 'http://gnubg.test');
        // gnubg 'Double, take' -> bot (sırası botta, zar atmadan) küp teklif eder.
        Http::fake(['gnubg.test/analyze' => Http::response(['cube' => ['proper' => 'Double, take']])]);
        $this->cubeRoom('black'); // sıra botta

        $res = $this->postJson('/api/rooms/BOTCU/bot', ['token' => 'human-tok'])->assertOk();
        $res->assertJsonPath('bot.0.cubeOffer', true);
        $res->assertJsonPath('bot.0.match.cube.pending', 'black');

        $room = Room::where('code', 'BOTCU')->first();
        $this->assertSame('black', $room->server_match['cube']['pending']); // teklif kaydedildi
    }

    public function test_botnudge_recovers_when_gnubg_returns(): void
    {
        config()->set('validator.url', 'http://validator.test');
        // Sıra botta, bot henüz oynamadı (gnubg önce yoktu) — şimdi geri geldi.
        $this->fakeBot([['from' => 0, 'to' => 3, 'die' => 3]]);
        Http::fake(['validator.test/validate' => Http::response(['valid' => true, 'state' => $this->turnState('white')])]);

        $this->botRoom('black', [3, 1]); // sıra botta, zar duruyor

        $res = $this->postJson('/api/rooms/BOTAA/bot', ['token' => 'human-tok'])->assertOk();
        $res->assertJsonPath('bot_status', 'played');
        $res->assertJsonPath('state.turn', 'white');       // güncel durum: bot oynadı, sıra insana
        $res->assertJsonPath('bot.0.state.turn', 'white');
    }
}
