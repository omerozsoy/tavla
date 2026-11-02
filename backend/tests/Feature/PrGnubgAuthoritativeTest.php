<?php

namespace Tests\Feature;

use App\Filament\Widgets\ServiceStatus;
use App\Jobs\AnalyzeMatchPrJob;
use App\Models\MatchResult;
use App\Models\User;
use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
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

            public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2, ?callable $onProgress = null): array
            {
                return ['pr' => $this->p, 'loss' => $this->l, 'decisions' => $this->d, 'evaluated' => $this->d,
                    'skipped' => 0, 'strictPr' => $this->p, 'loosePr' => $this->p, 'skipReasons' => [],
                    'firstSkip' => null, 'perDecision' => []];
            }

            public function cubePr(array $log, string $player, int $matchLength = 0, ?callable $onProgress = null): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 0,
                    'strictPr' => null, 'loosePr' => null, 'perDecision' => []];
            }
        };
    }

    /** İki-oyunculu ONLINE maçın iki satırını kurar (her iki renk de log'da). Kazanan = white. */
    private function onlineMatchRows(string $room): array
    {
        $log = [
            ['player' => 'white', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [3, 1], 'playedSteps' => [[8, 5]]],
            ['player' => 'black', 'pos' => ['points' => array_fill(0, 24, 0)], 'dice' => [6, 2], 'playedSteps' => [[24, 18]]],
        ];
        $w = MatchResult::create([
            'user_id' => User::factory()->create()->id, 'won' => true, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1516, 'delta' => 16,
            'match_length' => 1, 'match_type' => 'match', 'room_code' => $room, 'pr' => 99.0, // client PR BİLEREK yanlış
            'log' => json_encode(['hc' => 'white', 'log' => $log]),
        ]);
        $b = MatchResult::create([
            'user_id' => User::factory()->create()->id, 'won' => false, 'opponent_rating' => 1500,
            'rating_before' => 1500, 'rating_after' => 1484, 'delta' => -16,
            'match_length' => 1, 'match_type' => 'match', 'room_code' => $room, 'pr' => 99.0,
            'log' => json_encode(['hc' => 'black', 'log' => $log]),
        ]);

        return [$w, $b];
    }

    /**
     * TEK PR KAYNAĞI (2026-11-03): online maçın İKİ satırında da PrJob koşsa bile hiçbir PR DEĞERİ (self
     * veya opponent) YAZILMAZ -> iki satır Snowie'den gelecek değere kadar "—" kalır; per-pozisyonun
     * Snowie ile çelişen çapraz değerleri (DRHK8) artık OLUŞMAZ. Snowie tek analizden iki satırı tutarlı
     * doldurur (bkz AnalyzeMatchSnowieJobTest::test_both_rows_cross_consistent_from_single_analysis).
     */
    public function test_prjob_inert_on_both_online_rows(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        [$w, $b] = $this->onlineMatchRows('NOWRITE2');

        (new AnalyzeMatchPrJob($w->id))->handle($this->fakeOrch(chkPr: 3.0, chkLoss: 0.03, chkDec: 5));
        (new AnalyzeMatchPrJob($b->id))->handle($this->fakeOrch(chkPr: 29.0, chkLoss: 0.29, chkDec: 5));

        $w->refresh();
        $b->refresh();
        foreach ([$w, $b] as $row) {
            $this->assertNull($row->gnubg_pr, 'PrJob self PR YAZMAMALI (Snowie otoriter)');
            $this->assertNull($row->gnubg_opponent_pr, 'PrJob rakip PR YAZMAMALI');
            $this->assertNull($row->opponent_pr, 'PrJob opponent_pr fallback YAZMAMALI');
        }
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

    /**
     * TEK PR KAYNAĞI (2026-11-03): AnalyzeMatchPrJob ARTIK hiçbir PR DEĞERİ yazmaz — PR'ın tek otoritesi
     * Snowie (AnalyzeMatchSnowieJob). Kalkan yokken (taze satır) bile per-pozisyon değer YAZILMAZ; böylece
     * Snowie'ninkiyle çelişen ikinci bir PR asla oluşmaz (DRHK8 kök neden). Bu job yalnız Hata Günlüğü +
     * şans + mezar taşı bırakır; gösterilen PR'ı Snowie doldurur.
     */
    public function test_prjob_writes_no_pr_value_single_source_is_snowie(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $mr = $this->matchWithLog(clientPr: 12.0);
        // Taze: Snowie henüz koşmadı (gnubg_pr NULL, pr_shield_at NULL). İstemci totallerini de boşalt.
        MatchResult::where('id', $mr->id)->update([
            'pr' => null, 'pr_equity_lost' => null, 'pr_decisions' => null,
        ]);

        (new AnalyzeMatchPrJob($mr->id))->handle($this->fakeOrch(chkPr: 4.0, chkLoss: 0.048, chkDec: 6));

        $mr->refresh();
        $this->assertNull($mr->gnubg_pr, 'PrJob gnubg_pr YAZMAMALI (Snowie otoriter)');
        $this->assertNull($mr->gnubg_checker_pr, 'PrJob gnubg_checker_pr YAZMAMALI');
        $this->assertNull($mr->pr, 'PrJob otoriter pr YAZMAMALI');
        $this->assertNull($mr->gnubg_opponent_pr, 'PrJob rakip PR YAZMAMALI (Snowie iki tarafı birden yazar)');
        $this->assertNotNull($mr->gnubg_pr_at, 'skorlanabilir maç mezar taşı alır (heal döngüsü yok)');
    }

    /**
     * TEK PR KAYNAĞI: Otoriter PR'ı Snowie (AnalyzeMatchSnowieJob) yazar. Snowie bu satırı işlediyse
     * (pr_shield_at dolu), per-pozisyon AnalyzeMatchPrJob SONRADAN koşsa bile onu EZMEMELİ -> kullanıcı
     * tek PR (Snowie) görür; per-pozisyon (farklı cetvel) sızmaz.
     */
    public function test_per_position_defers_to_snowie_when_shield_set(): void
    {
        config(['gnubg.pr_mode' => 'authoritative']);
        $mr = $this->matchWithLog(clientPr: 12.0);
        // Snowie otoriter yazmış gibi: gnubg_pr=20.5 + pr_shield_at damgası.
        MatchResult::where('id', $mr->id)->update([
            'gnubg_pr' => 20.5, 'gnubg_checker_pr' => 20.5, 'pr' => 20.5,
            'pr_equity_lost' => 1.0, 'pr_decisions' => 10, 'pr_shield_at' => now(),
        ]);

        // Per-pozisyon FARKLI değer (4.0) üretir ama Snowie'yi EZMEMELİ.
        (new AnalyzeMatchPrJob($mr->id))->handle($this->fakeOrch(chkPr: 4.0, chkLoss: 0.048, chkDec: 6));

        $mr->refresh();
        $this->assertEqualsWithDelta(20.5, (float) $mr->gnubg_pr, 1e-6, 'Snowie (pr_shield_at) otoriter -> per-pozisyon 4.0 ile EZMEZ');
        $this->assertEqualsWithDelta(20.5, (float) $mr->pr, 1e-6, 'gösterilen pr da Snowie değerinde kalmalı');
        $this->assertSame(10, (int) $mr->pr_decisions, 'kariyer havuz totalleri de Snowie değerinde kalmalı');
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

    /** gnubg HİÇBİR pozisyon değerlendiremeyen (evaluated=0) sahte orkestrator -> pr 0.0 fallback. */
    private function emptyOrch(): AnalysisOrchestrator
    {
        return new class($this->app->make(GnuBgClient::class)) extends AnalysisOrchestrator
        {
            public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2, ?callable $onProgress = null): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 0,
                    'strictPr' => null, 'loosePr' => null, 'skipReasons' => [], 'firstSkip' => null, 'perDecision' => []];
            }

            public function cubePr(array $log, string $player, int $matchLength = 0, ?callable $onProgress = null): array
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

    /** gnubg mid-run erişilemez (skorlanacak içerik VAR ama hepsi gnubg_null): eval=0, skip=gnubg_null. */
    private function downOrch(): AnalysisOrchestrator
    {
        return new class($this->app->make(GnuBgClient::class)) extends AnalysisOrchestrator
        {
            public function checkerPr(array $log, string $player, int $matchLength = 0, int $plies = 2, ?callable $onProgress = null): array
            {
                return ['pr' => 0.0, 'loss' => 0.0, 'decisions' => 0, 'evaluated' => 0, 'skipped' => 1,
                    'strictPr' => null, 'loosePr' => null,
                    'skipReasons' => ['no_content' => 0, 'gnubg_null' => 1, 'no_match' => 0],
                    'firstSkip' => ['why' => 'gnubg_null'], 'perDecision' => []];
            }

            public function cubePr(array $log, string $player, int $matchLength = 0, ?callable $onProgress = null): array
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
        Queue::fake();

        $scarred = $this->matchWithLog(clientPr: 12.0); // gnubg_pr_at NULL + log dolu -> heal hedefi
        $done = $this->matchWithLog(clientPr: 5.0);      // zaten dolmuş -> heal ATLAMALI
        MatchResult::where('id', $done->id)->update(['gnubg_pr' => 3.0, 'gnubg_pr_at' => now()]);

        $this->artisan('tavla:gnubg-pr-heal')->assertExitCode(0);

        Queue::assertPushed(AnalyzeMatchPrJob::class, 1);
        Queue::assertPushed(
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
        Queue::fake();

        $this->matchWithLog(clientPr: 12.0); // yaralı maç var ama gnubg down -> dispatch YOK

        $this->artisan('tavla:gnubg-pr-heal')->assertExitCode(0);

        Queue::assertNothingPushed();
    }

    /** FAILOVER: birincil analyze instance düşükse (5xx/erişilemez) yedek instance devreye girer. */
    public function test_analyze_fails_over_to_backup_instance(): void
    {
        config([
            'gnubg.url' => 'http://127.0.0.1:8092',
            'gnubg.url_backup' => 'http://127.0.0.1:8093',
        ]);
        Http::fake([
            '127.0.0.1:8092/analyze' => Http::response('down', 500),
            '127.0.0.1:8093/analyze' => Http::response(
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
        Http::fake([
            '127.0.0.1:8092/health' => Http::response('down', 500),
            '127.0.0.1:8093/health' => Http::response(['ok' => true], 200),
        ]);

        $this->assertTrue($this->app->make(GnuBgClient::class)->analyzeHealthy(), 'yedek ayaktaysa analyzeHealthy true olmali');
    }

    /** İZOLASYON: canlı bot (analyze) ÖN plan havuzunu, PR/heal (analyzeBackground) ARKA plan havuzunu kullanır. */
    public function test_foreground_and_background_pools_are_isolated(): void
    {
        config([
            'gnubg.url' => 'http://127.0.0.1:8092',
            'gnubg.url_backup' => 'http://127.0.0.1:8093',                                 // ön plan (canlı bot)
            'gnubg.analysis_urls' => 'http://127.0.0.1:8094,http://127.0.0.1:8095',        // arka plan (PR/heal)
        ]);
        // Ön plan loss=9.9, arka plan loss=0.2 -> hangi havuzun kullanıldığını dönen değerden anlarız.
        Http::fake([
            '127.0.0.1:8092/analyze' => Http::response(['result' => ['hint' => []], 'played' => ['loss' => 9.9]], 200),
            '127.0.0.1:8093/analyze' => Http::response(['result' => ['hint' => []], 'played' => ['loss' => 9.9]], 200),
            '127.0.0.1:8094/analyze' => Http::response(['result' => ['hint' => []], 'played' => ['loss' => 0.2]], 200),
            '127.0.0.1:8095/analyze' => Http::response(['result' => ['hint' => []], 'played' => ['loss' => 0.2]], 200),
        ]);
        $client = $this->app->make(GnuBgClient::class);

        $fg = $client->analyze(['points' => array_fill(0, 24, 0)]);
        $bg = $client->analyzeBackground(['points' => array_fill(0, 24, 0)]);

        $this->assertEqualsWithDelta(9.9, (float) $fg['played']['loss'], 1e-9, 'canli bot ON plan havuzunu kullanmali');
        $this->assertEqualsWithDelta(0.2, (float) $bg['played']['loss'], 1e-9, 'PR/heal ARKA plan havuzunu kullanmali (canli oyunu mesgul etmez)');
    }

    /** Admin Servis Durumu: 4 gnubg instance AYRI satır (lamba) + doğru up/down. */
    public function test_service_status_shows_each_gnubg_instance_separately(): void
    {
        config([
            'gnubg.url' => 'http://127.0.0.1:8092',
            'gnubg.url_backup' => 'http://127.0.0.1:8093,http://127.0.0.1:8094,http://127.0.0.1:8095',
            'gnubg.units' => 'gnubg-analysis,gnubg-analysis-heavy,gnubg-analysis-3,gnubg-analysis-4',
        ]);
        Cache::flush();
        Http::fake([
            '127.0.0.1:8092/health' => Http::response(['ok' => true], 200),
            '127.0.0.1:8093/health' => Http::response(['ok' => true], 200),
            '127.0.0.1:8094/health' => Http::response('down', 500), // yedek #2 down
            '127.0.0.1:8095/health' => Http::response(['ok' => true], 200),
        ]);

        $status = (new ServiceStatus)->status();
        // Panel gnubg havuzlarını rol gruplarına ayırır; satır anahtarı 'gnubgp-{port}'. url + url_backup
        // = ön plan (Canlı YZ) havuzu -> o grubun satırları.
        $gnubgRows = collect($status['services'])
            ->filter(fn ($r) => str_starts_with($r['key'], 'gnubgp-') && str_contains($r['group'] ?? '', 'Canlı YZ'))
            ->values();

        $this->assertCount(4, $gnubgRows, '4 gnubg instance AYRI satir olmali');
        $this->assertTrue($gnubgRows[0]['up'], 'birincil (8092) yesil');
        $this->assertTrue($gnubgRows[1]['up'], 'yedek #1 (8093) yesil');
        $this->assertFalse($gnubgRows[2]['up'], 'yedek #2 (8094) kirmizi');
        $this->assertTrue($gnubgRows[3]['up'], 'yedek #3 (8095) yesil');
        // 1 instance down olsa da bot oynatilabilir (en az bir gnubg + validator... validator yok -> bot down);
        // en azindan gnubg tarafinin "en az biri up" mantigi calisiyor: 3/4 yesil.
        $this->assertSame(
            ['gnubgp-8092', 'gnubgp-8093', 'gnubgp-8094', 'gnubgp-8095'],
            $gnubgRows->pluck('key')->all(),
            'anahtarlar port bazli olmali (restart port -> birim eslemesi)',
        );
        $this->assertTrue($gnubgRows[3]['restart'], '8095 -> gnubg-analysis-4 birimi GNUBG_UNITS\'te -> restart edilebilir');
    }
}
