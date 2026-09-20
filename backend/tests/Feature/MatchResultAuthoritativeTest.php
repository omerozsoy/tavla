<?php

namespace Tests\Feature;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// SUNUCU-OTORITER galibiyet/maglubiyet: online macta (room_code) kazanan/kaybeden
// istemcinin 'won' beyanindan DEGIL, odanin paylasilan mac skorundan belirlenir.
// Boylece "kazandim" diye yalan/bayat beyan (perspektif hatasi) kaydi bozamaz.
class MatchResultAuthoritativeTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick): User
    {
        $u = User::create([
            'first_name' => $nick,
            'last_name' => 'T',
            'country' => '',
            'nickname' => $nick,
            'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    // p1=beyaz, p2=siyah. Skor black=3/white=0, target=3 -> SIYAH (p2) kazandi.
    private function makeFinishedRoom(User $p1, User $p2): Room
    {
        return Room::create([
            'code' => 'AUTHR',
            'p1_token' => 'tok1',
            'p1_user_id' => $p1->id,
            'p1_name' => $p1->nickname,
            'p2_token' => 'tok2',
            'p2_user_id' => $p2->id,
            'p2_name' => $p2->nickname,
            'status' => 'finished',
            'authoritative' => true, 'mode' => 'ranked',
            'server_match' => ['done' => true, 'winner' => 'black', 'target' => 3,
                'score' => ['white' => 0, 'black' => 3]],
            'target' => 3,
            'version' => 1,
            'settled' => false,
            'state' => [
                'match' => ['target' => 3, 'score' => ['white' => 0, 'black' => 3]],
                'gameEnd' => ['winner' => 'black'],
            ],
        ]);
    }

    public function test_false_win_claim_recorded_as_loss(): void
    {
        $white = $this->makeUser('whitey'); // p1
        $black = $this->makeUser('blacky'); // p2 (gercek kazanan)
        $this->makeFinishedRoom($white, $black);

        // Beyaz (KAYBEDEN) "kazandim" diye yalan raporlar.
        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => true, // yalan
            'opponent_rating' => 1500,
            'ranked' => true,
            'room_code' => 'AUTHR',
        ])->assertOk();

        $mr = MatchResult::where('user_id', $white->id)->latest('id')->first();
        $this->assertNotNull($mr);
        $this->assertFalse((bool) $mr->won, 'Sunucu skoru: beyaz kaybetti -> won=false olmali');
        $this->assertLessThan(1500, $white->fresh()->rating, 'Kaybeden rating dusmeli');
        $this->assertSame(1, (int) $white->fresh()->losses);
        $this->assertSame(0, (int) $white->fresh()->wins);
    }

    public function test_false_loss_claim_recorded_as_win(): void
    {
        $white = $this->makeUser('whitey2'); // p1
        $black = $this->makeUser('blacky2'); // p2 (gercek kazanan)
        $this->makeFinishedRoom($white, $black);

        // Siyah (KAZANAN) yanlislikla "kaybettim" raporlar (perspektif hatasi).
        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => false, // yanlis
            'opponent_rating' => 1500,
            'ranked' => true,
            'room_code' => 'AUTHR',
        ])->assertOk();

        $mr = MatchResult::where('user_id', $black->id)->latest('id')->first();
        $this->assertNotNull($mr);
        $this->assertTrue((bool) $mr->won, 'Sunucu skoru: siyah kazandi -> won=true olmali');
        $this->assertGreaterThan(1500, $black->fresh()->rating, 'Kazanan rating artmali');
        $this->assertSame(1, (int) $black->fresh()->wins);
    }

    public function test_no_room_rejects_client_result(): void
    {
        $u = $this->makeUser('solo');
        Sanctum::actingAs($u);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 4000, 'ranked' => true,
        ])->assertStatus(409)->assertJsonPath('reason', 'verified-match-required');
        $this->assertSame(1500, (int) $u->fresh()->rating);
        $this->assertSame(0, MatchResult::where('user_id', $u->id)->count());
    }

    // Rakibin beyanindan yeni sonuc uretme; bitmemis mac acikca reddedilir.
    public function test_undecided_room_rejects_even_when_opponent_reported(): void
    {
        $white = $this->makeUser('wu'); // p1
        $black = $this->makeUser('bu'); // p2
        Room::create([
            'code' => 'UNDEC', 'p1_token' => 't1', 'p1_user_id' => $white->id, 'p1_name' => 'wu',
            'p2_token' => 't2', 'p2_user_id' => $black->id, 'p2_name' => 'bu',
            'status' => 'playing', 'target' => 3, 'version' => 1, 'settled' => false,
            // Skor 1-0, hedef 3 -> KARARSIZ; p_result yok, gameEnd yok.
            'state' => ['match' => ['target' => 3, 'score' => ['white' => 1, 'black' => 0]]],
        ]);
        // Rakip (siyah) ONCE "kazandim" raporladi.
        MatchResult::create([
            'user_id' => $black->id, 'won' => true, 'opponent_rating' => 1500,
            'room_code' => 'UNDEC', 'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
        ]);

        // Beyaz da "kazandim" der -> ekonomik etki yaratmadan reddedilmeli.
        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'UNDEC',
        ])->assertStatus(409);

        $mr = MatchResult::where('user_id', $white->id)->latest('id')->first();
        $this->assertNull($mr);
        $this->assertSame(1500, (int) $white->fresh()->rating);
    }

    // ÜRETİM REPRODUCTION: online maç GERÇEK log (checker + cube kararları + mctx) ile raporlanır.
    // reportRating'in tüm senkron işleri (ErrorJournalService, prFromLog, achievement, opponent PR)
    // gerçek log üzerinde çalışır. Hiçbiri 500'e yol açmamalı ("puanın kaydedilemedi" bug'ı).
    public function test_report_with_full_online_log_does_not_500(): void
    {
        $white = $this->makeUser('logw'); // p1
        $black = $this->makeUser('logb'); // p2 (gerçek kazanan, score 0-3)
        $this->makeFinishedRoom($white, $black);

        $opening = [-2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2];
        $mctx = ['score' => ['white' => 0, 'black' => 0], 'cube' => 1, 'cubeOwner' => null, 'crawford' => false, 'matchLen' => 3];
        $pos = fn ($turn, $dice) => [
            'points' => $opening, 'bar' => ['white' => 0, 'black' => 0], 'off' => ['white' => 0, 'black' => 0],
            'turn' => $turn, 'dice' => $dice, 'diceUsed' => array_fill(0, max(2, count($dice)), false),
        ];
        $log = json_encode(['hc' => 'black', 'log' => [
            [
                'notation' => '24/22 13/11', 'best' => '24/22 13/11', 'loss' => 0.02,
                'pos' => $pos('black', [3, 2]), 'steps' => [],
                'playedSteps' => [['from' => 0, 'to' => 2, 'die' => 2], ['from' => 11, 'to' => 13, 'die' => 2]],
                'player' => 'black', 'dice' => [3, 2], 'cands' => [], 'probs' => [0.5, 0.1, 0.01, 0.3, 0.05, 0.01],
                'seq' => 0, 'countsForPR' => true, 'prAdjustedEquityLoss' => 0.02, 'mctx' => $mctx,
            ],
            [
                'notation' => '', 'best' => '', 'loss' => 0.0, 'player' => 'black', 'pos' => $pos('black', []),
                'seq' => 1, 'cube' => ['win' => 60, 'equity' => 0.3, 'recommended' => 'no-double', 'chosen' => 'no-double', 'correct' => true],
                'countsForPR' => false, 'prAdjustedEquityLoss' => 0.0, 'mctx' => $mctx,
            ],
        ]]);

        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'AUTHR',
            'match_length' => 3, 'match_type' => 'match', 'pr' => 3.33, 'luck' => 1.5,
            'score_self' => 3, 'score_opp' => 0, 'log' => $log,
        ])->assertOk();

        $mr = MatchResult::where('user_id', $black->id)->latest('id')->first();
        $this->assertNotNull($mr);
        $this->assertTrue((bool) $mr->won);
    }

    // Rakip ONCE (yaris aninda oda kararsizken) YANLIS raporladi; oda simdi KESIN.
    // Otoriter raporda rakibin satiri da tamamlayiciya cekilir (self-heal).
    public function test_authoritative_report_heals_opponent_wrong_row(): void
    {
        $white = $this->makeUser('wh'); // p1 (kaybeden)
        $black = $this->makeUser('bh'); // p2 (gercek kazanan)
        Room::create([
            'code' => 'HEAL', 'p1_token' => 't1', 'p1_user_id' => $white->id, 'p1_name' => 'wh',
            'p2_token' => 't2', 'p2_user_id' => $black->id, 'p2_name' => 'bh',
            'status' => 'finished', 'target' => 3, 'version' => 1, 'settled' => false,
            'authoritative' => true, 'mode' => 'ranked',
            'server_match' => ['done' => true, 'winner' => 'black', 'target' => 3,
                'score' => ['white' => 0, 'black' => 3]],
            'state' => ['match' => ['target' => 3, 'score' => ['white' => 0, 'black' => 3]]],
        ]);
        // Siyah (gercek KAZANAN) yanlislikla "kaybettim" raporlamis: rating dusmus.
        $black->rating = 1484;
        $black->losses = 1;
        $black->save();
        $blackRow = MatchResult::create([
            'user_id' => $black->id, 'won' => false, 'opponent_rating' => 1500,
            'room_code' => 'HEAL', 'rating_before' => 1500, 'rating_after' => 1484, 'delta' => -16,
        ]);

        // Beyaz (kaybeden) raporlar -> oda KESIN (beyaz kaybetti). Bu otoriter rapor
        // sirasinda siyahin yanlis satiri da duzeltilir (ikisi birden kaybedemez).
        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => false, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'HEAL',
        ])->assertOk();

        $blackRow->refresh();
        $this->assertTrue((bool) $blackRow->won, 'Siyahin satiri galibiyete duzeltilmeli');
        $this->assertSame(1516, (int) $blackRow->rating_after);
        $this->assertSame(1516, (int) $black->fresh()->rating, 'net +32: 1484 -> 1516');
        $this->assertSame(1, (int) $black->fresh()->wins);
        $this->assertSame(0, (int) $black->fresh()->losses);
    }

    // Silinmis oda veya rakibin eski raporu yeni ekonomik sonuc icin yetkili kanit degildir.
    public function test_purged_room_rejects_report_even_with_opponent_row(): void
    {
        $u = $this->makeUser('ghost');
        $opp = $this->makeUser('other');
        MatchResult::create([
            'user_id' => $opp->id, 'won' => false, 'room_code' => 'GONE',
            'opponent_rating' => 1500, 'rating_before' => 1600, 'rating_after' => 1584, 'delta' => -16,
        ]);
        Sanctum::actingAs($u);
        foreach (['GHOST', 'GONE'] as $code) {
            $this->postJson('/api/rating/report', [
                'won' => true, 'opponent_rating' => 4000, 'ranked' => true, 'room_code' => $code,
            ])->assertStatus(409);
        }
        $this->assertSame(1500, (int) $u->fresh()->rating);
        $this->assertSame(0, MatchResult::where('user_id', $u->id)->count());
    }

    // M2 (denetim): aynı room+user için ÇİFT rapor -> tek satır + tek Elo değişimi (çift-Elo yarışı
    // fix: serileştirme kilidi + unique index + idempotent erken-dönüş). "Yarım kalan" değil.
    public function test_double_report_is_idempotent_single_row(): void
    {
        $white = $this->makeUser('dupw'); // p1
        $black = $this->makeUser('dupb'); // p2 (kazanan)
        $this->makeFinishedRoom($white, $black);

        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'AUTHR',
        ])->assertOk();
        $ratingAfter1 = (int) $black->fresh()->rating;

        // İkinci (çift) rapor -> idempotent: rating DEĞİŞMEMELİ, ikinci satır OLUŞMAMALI.
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'AUTHR',
        ])->assertOk();

        $this->assertSame($ratingAfter1, (int) $black->fresh()->rating, 'ikinci rapor rating\'i değiştirmemeli');
        $this->assertSame(1, MatchResult::where('room_code', 'AUTHR')->where('user_id', $black->id)->count(), 'tek satır');
    }

    public function test_client_metadata_cannot_change_result_category_or_reward_evidence(): void
    {
        $white = $this->makeUser('metaw');
        $black = $this->makeUser('metab');
        $room = $this->makeFinishedRoom($white, $black);
        $room->p1_rating = 1500;
        $room->save();
        config()->set('validator.pr_mode', 'off');
        config()->set('gnubg.pr_mode', 'off');

        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => false, 'ranked' => false, 'match_type' => 'ai', 'match_length' => 25,
            'opponent_rating' => 4000, 'opponent_name' => 'forged', 'room_code' => 'AUTHR',
            'score_self' => 0, 'score_opp' => 99, 'pr' => 0, 'luck' => -99,
            'gammons' => 100, 'backgammons' => 100, 'ach_flags' => ['prime6', 'comeback'],
            'min_win_prob' => 0, 'log' => '{"hc":"black","log":[]}',
        ])->assertOk();

        $result = MatchResult::where('user_id', $black->id)->firstOrFail();
        $this->assertTrue($result->won);
        $this->assertSame('match', $result->match_type);
        $this->assertSame(3, (int) $result->match_length);
        $this->assertSame(1500, (int) $result->opponent_rating);
        $this->assertSame($white->nickname, $result->opponent_name);
        $this->assertSame(3, (int) $result->score_self);
        $this->assertSame(0, (int) $result->score_opp);
        $this->assertGreaterThan(1500, (int) $black->fresh()->rating);
        $stats = $black->fresh()->stat;
        $this->assertNotNull($stats);
        $this->assertSame(0, (int) $stats->total_gammons);
        $this->assertSame(0, (int) $stats->total_backgammons);
        $this->assertSame(0, (int) $stats->analysis_count);
        $this->assertNull($stats->best_error_rate);
    }

    public function test_finished_room_cannot_be_reported_by_a_third_user(): void
    {
        $white = $this->makeUser('ownerw');
        $black = $this->makeUser('ownerb');
        $outsider = $this->makeUser('outsider');
        $this->makeFinishedRoom($white, $black);
        Sanctum::actingAs($outsider);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 4000, 'room_code' => 'AUTHR',
        ])->assertStatus(409);
        $this->assertSame(0, MatchResult::where('user_id', $outsider->id)->count());
        $this->assertSame(1500, (int) $outsider->fresh()->rating);
    }

    // SUNUCU-OTORITER SANS (luck): her oyuncu KENDİ renginin HAM luck'ını raporlar; /me/match-pr
    // iki oyuncuya da AYNI çifti verir (self+opp). Çapraz-tutarlı: A'nın self'i = B'nin opp'u.
    // Böylece MatchResult net'i (kazanan−kaybeden) iki ekranda ÖZDEŞ -> "farklı şans" bug'ı biter.
    public function test_luck_is_cross_client_consistent(): void
    {
        $white = $this->makeUser('wluck'); // p1
        $black = $this->makeUser('bluck'); // p2
        $this->makeFinishedRoom($white, $black);

        // Beyaz kendi HAM luck'ını (0.42) raporlar.
        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => false, 'opponent_rating' => 1500, 'ranked' => true,
            'room_code' => 'AUTHR', 'luck' => 0.42,
        ])->assertOk();

        // Siyah kendi HAM luck'ını (-0.17) raporlar.
        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true,
            'room_code' => 'AUTHR', 'luck' => -0.17,
        ])->assertOk();

        // Beyaz gözünden: self=0.42 (kendi), opp=-0.17 (siyahın).
        Sanctum::actingAs($white);
        $wPair = $this->getJson('/api/me/match-pr?room_code=AUTHR')->assertOk()->json();
        $this->assertEqualsWithDelta(0.42, $wPair['luck_self'], 1e-6);
        $this->assertEqualsWithDelta(-0.17, $wPair['luck_opp'], 1e-6);

        // Siyah gözünden: self=-0.17 (kendi), opp=0.42 (beyazın).
        Sanctum::actingAs($black);
        $bPair = $this->getJson('/api/me/match-pr?room_code=AUTHR')->assertOk()->json();
        $this->assertEqualsWithDelta(-0.17, $bPair['luck_self'], 1e-6);
        $this->assertEqualsWithDelta(0.42, $bPair['luck_opp'], 1e-6);

        // ÇAPRAZ TUTARLILIK: A.self == B.opp ve A.opp == B.self (renk-keyli tek kaynak).
        $this->assertEqualsWithDelta($wPair['luck_self'], $bPair['luck_opp'], 1e-6);
        $this->assertEqualsWithDelta($wPair['luck_opp'], $bPair['luck_self'], 1e-6);

        // Gösterilen net (white − black) İKİ ekranda özdeş: 0.42 − (−0.17) = 0.59.
        $netWhiteScreen = $wPair['luck_self'] - $wPair['luck_opp']; // beyaz: white−black
        $netBlackScreen = $bPair['luck_opp'] - $bPair['luck_self']; // siyah: white−black
        $this->assertEqualsWithDelta(0.59, $netWhiteScreen, 1e-6);
        $this->assertEqualsWithDelta($netWhiteScreen, $netBlackScreen, 1e-6);
    }
}
