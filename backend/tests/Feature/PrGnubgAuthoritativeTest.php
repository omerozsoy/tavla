<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeMatchPrJob;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ANA KURAL (A→Z gnubg): pr_mode=authoritative iken gosterilen/otoriter PR = gnubg (cubeful EMG),
 * istemci wildbg PR'i EZILIR. shadow/off iken otoriter pr'a DOKUNULMAZ (yalniz gnubg_* shadow).
 */
class PrGnubgAuthoritativeTest extends TestCase
{
    use RefreshDatabase;

    /** gnubg'yi taklit eden orkestrator (servis cagirmadan sabit PR dondurur). */
    private function fakeOrch(float $chkPr, float $chkLoss, int $chkDec): AnalysisOrchestrator
    {
        return new class($this->app->make(GnuBgClient::class), $chkPr, $chkLoss, $chkDec) extends AnalysisOrchestrator
        {
            public function __construct(GnuBgClient $g, private float $p, private float $l, private int $d)
            {
                parent::__construct($g);
            }

            public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2): array
            {
                return ['pr' => $this->p, 'loss' => $this->l, 'decisions' => $this->d, 'evaluated' => $this->d,
                    'skipped' => 0, 'strictPr' => $this->p, 'loosePr' => $this->p, 'skipReasons' => [],
                    'firstSkip' => null, 'perDecision' => []];
            }

            public function cubePr(array $log, string $player, int $matchLength = 0): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 0,
                    'strictPr' => null, 'loosePr' => null, 'perDecision' => []];
            }
        };
    }

    private function matchWithLog(float $clientPr): MatchResult
    {
        $u = User::factory()->create();

        return MatchResult::create([
            'user_id' => $u->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 3, 'match_type' => 'match', 'pr' => $clientPr,
            'pr_equity_lost' => 0.5, 'pr_decisions' => 10, // istemci (wildbg) totalleri
            'log' => json_encode(['hc' => 'white', 'log' => [
                ['player' => 'white', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [3, 1], 'playedSteps' => [[8, 5]]],
            ]]),
        ]);
    }

    public function test_authoritative_overwrites_pr_with_gnubg(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $mr = $this->matchWithLog(clientPr: 12.0); // istemci wildbg: 12 (sisirilmis)

        // gnubg: checker loss 0.048 / 6 karar -> overall = (0.048/6)*500 = 4.0
        (new AnalyzeMatchPrJob($mr->id))->handle($this->fakeOrch(chkPr: 4.0, chkLoss: 0.048, chkDec: 6));

        $mr->refresh();
        $this->assertEqualsWithDelta(4.0, (float) $mr->pr, 1e-6, 'otoriter PR gnubg olmali');
        $this->assertEqualsWithDelta(0.048, (float) $mr->pr_equity_lost, 1e-6);
        $this->assertSame(6, (int) $mr->pr_decisions);
        $this->assertEqualsWithDelta(4.0, (float) $mr->gnubg_pr, 1e-6);
    }

    public function test_match_pr_gnubg_endpoint_ready_flag(): void
    {
        $u = User::factory()->create();
        $mr = MatchResult::create([
            'user_id' => $u->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 3, 'match_type' => 'match', 'pr' => 12.0,
        ]);

        // gnubg_pr yok -> ready=false
        $this->actingAs($u)->getJson("/api/me/match-pr-gnubg/{$mr->id}")
            ->assertOk()->assertJson(['ready' => false, 'pr' => null]);

        // gnubg analiz bitti -> ready=true + gnubg degerleri
        MatchResult::where('id', $mr->id)->update(['gnubg_pr' => 2.85, 'gnubg_checker_pr' => 2.6, 'gnubg_cube_pr' => 4.0]);
        $this->actingAs($u)->getJson("/api/me/match-pr-gnubg/{$mr->id}")
            ->assertOk()->assertJson(['ready' => true, 'pr' => 2.85, 'checker_pr' => 2.6, 'cube_pr' => 4.0]);

        // baskasinin maci -> 403
        $other = User::factory()->create();
        $this->actingAs($other)->getJson("/api/me/match-pr-gnubg/{$mr->id}")->assertStatus(403);
    }

    public function test_online_opponent_pr_filled_from_own_log_when_opponent_never_reported(): void
    {
        // Rakip (kaybeden) HİÇ raporlamadı: karşı satır YOK. Kazananın log'u rakibin reconstructed
        // hamlelerini de içerir -> gnubg rakip PR'ını AYNI log'dan hesaplar. Sonuç ekranı (gnubg_opponent_pr)
        // + tarihsel "Maç Analizleri" (opponent_pr) artık "—" yerine sayı gösterir.
        config(['gnubg.pr_mode' => 'authoritative']);
        $u = User::factory()->create();
        $mr = MatchResult::create([
            'user_id' => $u->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 3, 'match_type' => 'match', 'pr' => 12.0,
            'room_code' => 'ABCDE', // ONLINE maç
            'log' => json_encode(['hc' => 'white', 'log' => [
                ['player' => 'white', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [3, 1], 'playedSteps' => [[8, 5]]],
                ['player' => 'black', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [6, 2], 'playedSteps' => [[24, 18]]],
            ]]),
        ]);

        (new AnalyzeMatchPrJob($mr->id))->handle($this->fakeOrch(chkPr: 4.0, chkLoss: 0.048, chkDec: 6));

        $mr->refresh();
        $this->assertNotNull($mr->gnubg_opponent_pr, 'online rakip gnubg PR log\'dan dolmali (sonuç ekranı)');
        $this->assertEqualsWithDelta(4.0, (float) $mr->gnubg_opponent_pr, 1e-6);
        $this->assertNotNull($mr->opponent_pr, 'online rakip opponent_pr fallback dolmali (Maç Analizleri)');
        $this->assertEqualsWithDelta(4.0, (float) $mr->opponent_pr, 1e-6);
    }

    /** gnubg HİÇBİR pozisyon değerlendiremeyen (evaluated=0) sahte orkestrator -> pr 0.0 fallback. */
    private function emptyOrch(): AnalysisOrchestrator
    {
        return new class($this->app->make(GnuBgClient::class)) extends AnalysisOrchestrator
        {
            public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 0,
                    'strictPr' => null, 'loosePr' => null, 'skipReasons' => [], 'firstSkip' => null, 'perDecision' => []];
            }

            public function cubePr(array $log, string $player, int $matchLength = 0): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 0,
                    'strictPr' => null, 'loosePr' => null, 'perDecision' => []];
            }
        };
    }

    /**
     * KÖK FIX: gnubg log'dan hiçbir kararı skorlayamazsa (evaluated=0) checkerPr/cubePr "PR asla null
     * olmasın" direktifi gereği 0.0 döner. Bu SAHTE 0.0 kolonlara YAZILMAMALI — aksi halde sonuç
     * ekranında kaybeden "0.00 + Super Grandmaster" (divisionOfPR(0)=en üst seviye) görünüyordu.
     */
    public function test_sentinel_zero_pr_not_persisted(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $u = User::factory()->create();
        $mr = MatchResult::create([
            'user_id' => $u->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 3, 'match_type' => 'match', 'pr' => null,
            'room_code' => 'ZEROZ', // ONLINE (rakip reconstruction denenecek)
            'log' => json_encode(['hc' => 'white', 'log' => [
                ['player' => 'white', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [3, 1], 'playedSteps' => [[8, 5]]],
            ]]),
        ]);

        (new AnalyzeMatchPrJob($mr->id))->handle($this->emptyOrch());

        $mr->refresh();
        $this->assertNull($mr->gnubg_pr, 'değerlendirme yoksa sahte 0.0 gnubg_pr YAZILMAMALI');
        $this->assertNull($mr->gnubg_checker_pr, 'değerlendirme yoksa sahte 0.0 gnubg_checker_pr YAZILMAMALI');
        $this->assertNull($mr->gnubg_opponent_pr, 'rakip skorlanamadıysa gnubg_opponent_pr YAZILMAMALI (0.00+Super GM bug)');
        $this->assertNull($mr->opponent_pr, 'rakip opponent_pr fallback da yazılmamalı');
    }

    /** Küpü hiç olmayan maçta (cube evaluated=0) gnubg_cube_pr sahte 0.00 yerine NULL kalmalı -> "—". */
    public function test_cube_pr_null_when_no_cube_positions(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $mr = $this->matchWithLog(clientPr: 12.0);

        // fakeOrch: checker evaluated=6 (dolu), cube evaluated=0 (küp kararı yok).
        (new AnalyzeMatchPrJob($mr->id))->handle($this->fakeOrch(chkPr: 4.0, chkLoss: 0.048, chkDec: 6));

        $mr->refresh();
        $this->assertEqualsWithDelta(4.0, (float) $mr->gnubg_checker_pr, 1e-6, 'pul PR yazılmalı');
        $this->assertNull($mr->gnubg_cube_pr, 'küp kararı yoksa gnubg_cube_pr sahte 0.00 değil NULL olmalı');
    }

    public function test_shadow_does_not_touch_authoritative_pr(): void
    {
        config(['gnubg.pr_mode' => 'shadow']);
        $mr = $this->matchWithLog(clientPr: 12.0);

        (new AnalyzeMatchPrJob($mr->id))->handle($this->fakeOrch(chkPr: 4.0, chkLoss: 0.048, chkDec: 6));

        $mr->refresh();
        $this->assertEqualsWithDelta(12.0, (float) $mr->pr, 1e-6, 'shadow: otoriter PR degismemeli');
        $this->assertEqualsWithDelta(4.0, (float) $mr->gnubg_pr, 1e-6, 'shadow: gnubg_pr yine dolmali');
    }

    /** gnubg mid-run erişilemez (skorlanacak içerik VAR ama hepsi gnubg_null): eval=0, skip=gnubg_null. */
    private function downOrch(): AnalysisOrchestrator
    {
        return new class($this->app->make(GnuBgClient::class)) extends AnalysisOrchestrator
        {
            public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 1,
                    'strictPr' => null, 'loosePr' => null,
                    'skipReasons' => ['no_content' => 0, 'gnubg_null' => 1, 'no_match' => 0],
                    'firstSkip' => ['why' => 'gnubg_null'], 'perDecision' => []];
            }

            public function cubePr(array $log, string $player, int $matchLength = 0): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 0,
                    'strictPr' => null, 'loosePr' => null, 'perDecision' => []];
            }
        };
    }

    /**
     * KÖK FIX (kalıcı "—"): gnubg mid-run düşüp SELF kararları skorlayamazsa (gnubg_null>0, eval=0) job
     * FIRLATMALI ki $tries/backoff retry + heal cron yeniden denesin. Ayrıca gnubg_pr_at YAZILMAMALI
     * (mezar taşı KONMAMALI) -> heal komutu bu maçı "gnubg'ye ulaşılamadı" olarak yakalayıp yeniden dener.
     */
    public function test_job_throws_and_leaves_no_tombstone_when_gnubg_unavailable(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $mr = $this->matchWithLog(clientPr: 12.0);

        $threw = false;
        try {
            (new AnalyzeMatchPrJob($mr->id))->handle($this->downOrch());
        } catch (\RuntimeException $e) {
            $threw = true;
        }

        $this->assertTrue($threw, 'gnubg erisilemezken job FIRLATMALI (retry + heal tetiklensin)');
        $mr->refresh();
        $this->assertNull($mr->gnubg_pr, 'gnubg down -> PR yazilmamali');
        $this->assertNull($mr->gnubg_pr_at, 'gnubg down -> mezar tasi KONMAMALI (heal yeniden denesin)');
    }

    /**
     * gnubg'ye ULAŞILDI ama log gerçekten analiz-dışı (evaluated=0, gnubg_null=0): PR null kalır ("—")
     * AMA gnubg_pr_at mezar taşı KONMALI ki tavla:gnubg-pr-heal bu maçı sonsuza dek yeniden denemesin.
     */
    public function test_unscoreable_match_gets_tombstone_so_heal_skips_it(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $mr = $this->matchWithLog(clientPr: 12.0);

        (new AnalyzeMatchPrJob($mr->id))->handle($this->emptyOrch());

        $mr->refresh();
        $this->assertNull($mr->gnubg_pr, 'skorlanamadi -> PR null (ekran "—")');
        $this->assertNotNull($mr->gnubg_pr_at, 'gnubg ulasildi ama bos -> mezar tasi konmali (heal loop olmasin)');
    }

    /** heal komutu: gnubg'ye HİÇ ulaşılamamış (gnubg_pr_at NULL) maçları yeniden kuyruğa alır; dolmuşları atlar. */
    public function test_heal_requeues_matches_never_reached_by_gnubg(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        // gnubg health=true mock (gerçek HTTP yok) -> heal komutu ilerlesin.
        $this->app->instance(GnuBgClient::class, new class extends GnuBgClient
        {
            public function analyzeHealthy(): bool
            {
                return true;
            }
        });
        \Illuminate\Support\Facades\Queue::fake();

        $scarred = $this->matchWithLog(clientPr: 12.0); // gnubg_pr_at NULL + log dolu -> heal hedefi
        $done = $this->matchWithLog(clientPr: 5.0);      // zaten dolmuş -> heal ATLAMALI
        MatchResult::where('id', $done->id)->update(['gnubg_pr' => 3.0, 'gnubg_pr_at' => now()]);

        $this->artisan('tavla:gnubg-pr-heal')->assertExitCode(0);

        \Illuminate\Support\Facades\Queue::assertPushed(AnalyzeMatchPrJob::class, 1);
        \Illuminate\Support\Facades\Queue::assertPushed(
            AnalyzeMatchPrJob::class,
            fn (AnalyzeMatchPrJob $job) => $job->matchResultId === $scarred->id
        );
    }

    /** heal komutu: gnubg down iken kendini erteler (boşa iş / failed_jobs birikmesi yok). */
    public function test_heal_defers_when_gnubg_down(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $this->app->instance(GnuBgClient::class, new class extends GnuBgClient
        {
            public function analyzeHealthy(): bool
            {
                return false;
            }
        });
        \Illuminate\Support\Facades\Queue::fake();

        $this->matchWithLog(clientPr: 12.0); // yaralı maç var ama gnubg down -> dispatch YOK

        $this->artisan('tavla:gnubg-pr-heal')->assertExitCode(0);

        \Illuminate\Support\Facades\Queue::assertNothingPushed();
    }

    /** FAILOVER: birincil analyze instance düşükse (5xx/erişilemez) yedek instance devreye girer. */
    public function test_analyze_fails_over_to_backup_instance(): void
    {
        config([
            'gnubg.url' => 'http://127.0.0.1:8092',
            'gnubg.url_backup' => 'http://127.0.0.1:8093',
        ]);
        \Illuminate\Support\Facades\Http::fake([
            '127.0.0.1:8092/analyze' => \Illuminate\Support\Facades\Http::response('down', 500),
            '127.0.0.1:8093/analyze' => \Illuminate\Support\Facades\Http::response(
                ['result' => ['hint' => []], 'played' => ['loss' => 0.12]], 200
            ),
        ]);

        $res = $this->app->make(GnuBgClient::class)->analyze(['points' => array_fill(0, 24, 0)]);

        $this->assertNotNull($res, 'birincil 5xx -> yedek instance yaniti donmeli (failover)');
        $this->assertEqualsWithDelta(0.12, (float) $res['played']['loss'], 1e-9);
    }

    /** analyzeHealthy: birincil down olsa da YEDEK ayaktaysa true (PR hesaplanabilir -> job ertelenmez). */
    public function test_analyze_healthy_true_when_only_backup_up(): void
    {
        config([
            'gnubg.url' => 'http://127.0.0.1:8092',
            'gnubg.url_backup' => 'http://127.0.0.1:8093',
        ]);
        \Illuminate\Support\Facades\Http::fake([
            '127.0.0.1:8092/health' => \Illuminate\Support\Facades\Http::response('down', 500),
            '127.0.0.1:8093/health' => \Illuminate\Support\Facades\Http::response(['ok' => true], 200),
        ]);

        $this->assertTrue($this->app->make(GnuBgClient::class)->analyzeHealthy(), 'yedek ayaktaysa analyzeHealthy true olmali');
    }

    /** Admin Servis Durumu: 4 gnubg instance AYRI satır (lamba) + doğru up/down. */
    public function test_service_status_shows_each_gnubg_instance_separately(): void
    {
        config([
            'gnubg.url' => 'http://127.0.0.1:8092',
            'gnubg.url_backup' => 'http://127.0.0.1:8093,http://127.0.0.1:8094,http://127.0.0.1:8095',
            'gnubg.units' => 'gnubg-analysis,gnubg-analysis-heavy,gnubg-analysis-3,gnubg-analysis-4',
        ]);
        \Illuminate\Support\Facades\Cache::flush();
        \Illuminate\Support\Facades\Http::fake([
            '127.0.0.1:8092/health' => \Illuminate\Support\Facades\Http::response(['ok' => true], 200),
            '127.0.0.1:8093/health' => \Illuminate\Support\Facades\Http::response(['ok' => true], 200),
            '127.0.0.1:8094/health' => \Illuminate\Support\Facades\Http::response('down', 500), // yedek #2 down
            '127.0.0.1:8095/health' => \Illuminate\Support\Facades\Http::response(['ok' => true], 200),
        ]);

        $status = (new \App\Filament\Widgets\ServiceStatus)->status();
        $gnubgRows = collect($status['services'])
            ->filter(fn ($r) => $r['key'] === 'gnubg' || str_starts_with($r['key'], 'gnubg-'))
            ->values();

        $this->assertCount(4, $gnubgRows, '4 gnubg instance AYRI satir olmali');
        $this->assertTrue($gnubgRows[0]['up'], 'birincil (8092) yesil');
        $this->assertTrue($gnubgRows[1]['up'], 'yedek #1 (8093) yesil');
        $this->assertFalse($gnubgRows[2]['up'], 'yedek #2 (8094) kirmizi');
        $this->assertTrue($gnubgRows[3]['up'], 'yedek #3 (8095) yesil');
        // 1 instance down olsa da bot oynatilabilir (en az bir gnubg + validator... validator yok -> bot down);
        // en azindan gnubg tarafinin "en az biri up" mantigi calisiyor: 3/4 yesil.
        $this->assertSame('gnubg-3', $gnubgRows[3]['key'], 'yedek #3 anahtari gnubg-3 olmali (restart eslemesi)');
    }
}
