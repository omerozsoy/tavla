<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

// Tavlai Luck V1 UÇTAN UCA: gerçek reportRating -> gerçek database queue -> gerçek AnalyzeMatchLuckJob
// (yalnız gnubg HTTP mock'lu, çünkü gnubg sunucuda) -> match_results.luck_mwc -> /me/match-pr.
// İki oyuncunun sonuç ekranında BAĞIMSIZ % göreceğini (çapraz-tutarlı) kanıtlar. gnubg'nin gerçek
// .mat->luck hesabı ayrıca sunucuda selftest ile doğrulandı (tavla:gnubg-matchluck-test).
class LuckV1EndToEndTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n): User
    {
        $u = User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n, 'email' => $n.'@e.com', 'password' => bcrypt('secret123'),
        ]);
        $u->rating = 1500;
        $u->save();

        return $u;
    }

    // p1=beyaz, p2=siyah; skor black=1/white=0, target=1 -> SIYAH kazandı.
    private function room(User $w, User $b): Room
    {
        return Room::create([
            'code' => 'LKE2E', 'p1_token' => 't1', 'p1_user_id' => $w->id, 'p1_name' => $w->nickname,
            'p2_token' => 't2', 'p2_user_id' => $b->id, 'p2_name' => $b->nickname,
            'status' => 'finished', 'target' => 1, 'version' => 1, 'settled' => false,
            'state' => ['match' => ['target' => 1, 'score' => ['white' => 0, 'black' => 1]],
                'gameEnd' => ['winner' => 'black']],
        ]);
    }

    public function test_full_chain_report_to_queue_to_matchpr(): void
    {
        // gnubg SHADOW açık + gnubg HTTP mock (gerçek gnubg sunucuda; burada .mat->luck davranışını taklit).
        config(['gnubg.pr_mode' => 'shadow']);
        $mock = Mockery::mock(GnuBgClient::class);
        // p0 (white/sol) = +39.0% ; p1 (black/sağ) = -13.0% — gnubg selftest ölçeğiyle aynı biçim.
        $mock->shouldReceive('matchluck')->andReturn([
            'import_cmd' => 'import mat',
            'luck' => [
                'names' => ['White', 'Black'],
                'p0' => ['mwc_total' => 39.0, 'emg_total' => 0.78],
                'p1' => ['mwc_total' => -13.0, 'emg_total' => -0.26],
            ],
        ]);
        // PR job da tetiklenir; log.log=[] -> PR job erken döner (gnubg'ye gitmez). analyze çağrılmaz.
        $this->app->instance(GnuBgClient::class, $mock);

        $white = $this->user('w2e');
        $black = $this->user('b2e');
        $this->room($white, $black);

        // .mat: geçerli-görünümlü (mock içeriğe bakmaz); log: hc + boş moves (PR job'ı gnubg'siz bırakır).
        $mat = "1 point match\n\n Game 1\n w2e : 0                      b2e : 0\n  1) 31: 8/5 6/5                42: 24/20 13/11\n      Wins 1 point\n";

        // 1) BEYAZ (kaybeden) raporlar — .mat + log(hc=white).
        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => false, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'LKE2E',
            'match_length' => 1, 'mat' => $mat, 'log' => json_encode(['hc' => 'white', 'log' => []]),
        ])->assertOk();

        // 2) SIYAH (kazanan) raporlar — .mat + log(hc=black).
        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'LKE2E',
            'match_length' => 1, 'mat' => $mat, 'log' => json_encode(['hc' => 'black', 'log' => []]),
        ])->assertOk();

        // 3) GERÇEK queue worker — database bağlantısındaki job'ları (luck + no-op PR) işle.
        Artisan::call('queue:work', ['connection' => 'database', '--stop-when-empty' => true, '--tries' => 1]);

        // 4) /me/match-pr — BEYAZ gözünden: self = white(p0) = +39.0, opp = black(p1) = -13.0.
        Sanctum::actingAs($white);
        $wp = $this->getJson('/api/me/match-pr?room_code=LKE2E')->assertOk()->json();
        $this->assertEqualsWithDelta(39.0, $wp['luck_mwc_self'], 1e-6, 'beyaz kendi MWC luck (p0)');
        $this->assertEqualsWithDelta(-13.0, $wp['luck_mwc_opp'], 1e-6, 'beyaz gözünden rakip (p1)');

        // 5) SIYAH gözünden: self = black(p1) = -13.0, opp = white(p0) = +39.0.
        Sanctum::actingAs($black);
        $bp = $this->getJson('/api/me/match-pr?room_code=LKE2E')->assertOk()->json();
        $this->assertEqualsWithDelta(-13.0, $bp['luck_mwc_self'], 1e-6, 'siyah kendi MWC luck (p1)');
        $this->assertEqualsWithDelta(39.0, $bp['luck_mwc_opp'], 1e-6, 'siyah gözünden rakip (p0)');

        // 6) ÇAPRAZ TUTARLILIK: beyaz.self == siyah.opp ve beyaz.opp == siyah.self (tek kaynak, iki ekran).
        $this->assertEqualsWithDelta($wp['luck_mwc_self'], $bp['luck_mwc_opp'], 1e-6);
        $this->assertEqualsWithDelta($wp['luck_mwc_opp'], $bp['luck_mwc_self'], 1e-6);

        // 7) BAĞIMSIZ (sıfır-toplam DEĞİL): +39.0 + (-13.0) = +26.0 != 0 (gnubg metodolojisi).
        $this->assertNotEqualsWithDelta(0.0, $wp['luck_mwc_self'] + $wp['luck_mwc_opp'], 1e-6);
    }

    public function test_no_mat_leaves_luck_mwc_null(): void
    {
        // .mat gönderilmezse gnubg luck job dispatch EDİLMEZ -> luck_mwc null kalır (istemci ONNX fallback).
        config(['gnubg.pr_mode' => 'shadow']);
        $white = $this->user('w3');
        $black = $this->user('b3');
        $this->room($white, $black);

        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'LKE2E',
            'match_length' => 1, 'log' => json_encode(['hc' => 'black', 'log' => []]),
        ])->assertOk();

        Artisan::call('queue:work', ['connection' => 'database', '--stop-when-empty' => true, '--tries' => 1]);

        $bp = $this->getJson('/api/me/match-pr?room_code=LKE2E')->assertOk()->json();
        $this->assertNull($bp['luck_mwc_self'], 'mat yoksa gnubg luck yok -> null');
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
