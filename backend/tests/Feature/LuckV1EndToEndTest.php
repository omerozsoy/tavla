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

// Tavlai Luck V1 UÇTAN UCA (KALICI): gerçek reportRating -> gerçek database queue -> gerçek
// AnalyzeMatchLuckJob (İKİ oyuncunun logunu BİRLEŞTİRİP .mat kurar) -> match_results.luck_mwc ->
// /me/match-pr. gnubg HTTP mock'lu. İki ekranda BAĞIMSIZ % + çapraz-tutarlı olduğunu kanıtlar.
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

    public function test_full_chain_merged_report_to_queue_to_matchpr(): void
    {
        config(['gnubg.pr_mode' => 'shadow']);
        $mock = Mockery::mock(GnuBgClient::class);
        // Birleştirilmiş .mat -> p0 (white) +39.0% ; p1 (black) -13.0%.
        $mock->shouldReceive('matchluck')->andReturn([
            'luck' => [
                'p0' => ['mwc_total' => 39.0, 'emg_total' => 0.78],
                'p1' => ['mwc_total' => -13.0, 'emg_total' => -0.26],
            ],
        ]);
        // PR job da tetiklenir -> analyze/health mock'la (null -> PR sessiz atlar).
        $mock->shouldReceive('analyze')->andReturnNull();
        $mock->shouldReceive('health')->andReturnTrue();
        $this->app->instance(GnuBgClient::class, $mock);

        $white = $this->user('w2e');
        $black = $this->user('b2e');
        $this->room($white, $black);

        // Her oyuncu KENDİ renginde tam log gönderir (rakip renginde çöp -> birleştirme eler).
        $whiteLog = json_encode(['hc' => 'white', 'log' => [
            ['player' => 'white', 'notation' => '8/5 6/5', 'dice' => [3, 1], 'seq' => 0],
        ]]);
        $blackLog = json_encode(['hc' => 'black', 'log' => [
            ['player' => 'black', 'notation' => '24/21 13/11', 'dice' => [3, 2], 'seq' => 1],
        ]]);

        Sanctum::actingAs($white);
        $this->postJson('/api/rating/report', [
            'won' => false, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'LKE2E',
            'match_length' => 1, 'log' => $whiteLog,
        ])->assertOk();

        Sanctum::actingAs($black);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'room_code' => 'LKE2E',
            'match_length' => 1, 'log' => $blackLog,
        ])->assertOk();

        // Gerçek queue worker: luck (+ no-op PR) job'ları işle.
        Artisan::call('queue:work', ['connection' => 'database', '--stop-when-empty' => true, '--tries' => 1]);

        // BEYAZ gözünden: self=white(p0)=+39, opp=black(p1)=-13.
        Sanctum::actingAs($white);
        $wp = $this->getJson('/api/me/match-pr?room_code=LKE2E')->assertOk()->json();
        $this->assertEqualsWithDelta(39.0, $wp['luck_mwc_self'], 1e-6);
        $this->assertEqualsWithDelta(-13.0, $wp['luck_mwc_opp'], 1e-6);

        // SIYAH gözünden: self=black(p1)=-13, opp=white(p0)=+39.
        Sanctum::actingAs($black);
        $bp = $this->getJson('/api/me/match-pr?room_code=LKE2E')->assertOk()->json();
        $this->assertEqualsWithDelta(-13.0, $bp['luck_mwc_self'], 1e-6);
        $this->assertEqualsWithDelta(39.0, $bp['luck_mwc_opp'], 1e-6);

        // Çapraz tutarlılık + bağımsız (sıfır-toplam değil).
        $this->assertEqualsWithDelta($wp['luck_mwc_self'], $bp['luck_mwc_opp'], 1e-6);
        $this->assertNotEqualsWithDelta(0.0, $wp['luck_mwc_self'] + $wp['luck_mwc_opp'], 1e-6);
    }

    public function test_offline_no_room_no_luck(): void
    {
        // room_code yok (pvb/solo) -> luck job dispatch edilmez -> luck_mwc null.
        config(['gnubg.pr_mode' => 'shadow']);
        $u = $this->user('solo');
        Sanctum::actingAs($u);
        $this->postJson('/api/rating/report', [
            'won' => true, 'opponent_rating' => 1500, 'ranked' => true, 'match_length' => 1,
            'log' => json_encode(['hc' => 'white', 'log' => []]),
        ])->assertOk();

        Artisan::call('queue:work', ['connection' => 'database', '--stop-when-empty' => true, '--tries' => 1]);

        $mr = \App\Models\MatchResult::where('user_id', $u->id)->latest('id')->first();
        $this->assertNull($mr->luck_mwc);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
