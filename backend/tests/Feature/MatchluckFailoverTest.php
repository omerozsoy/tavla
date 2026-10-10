<?php

namespace Tests\Feature;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * KÖK OLAY (2026-10-10): tek ağır instance (:8098) matchluck'ta SEGV crash-loop'a girdi; matchluck
 * SPOF olduğu için (tryHeavy YERİNE tek heavyUrl) şans (Luck V1) 7 saat boyunca HİÇ hesaplanmadı.
 * Bu testler kalıcı düzeltmeleri kilitler: (1) matchluck artık FAILOVER'lı, (2) heavy motor probe'u
 * /health değil GERÇEK matchluck ile ölçer (SEGV'de /health yeşil kalır), (3) port->birim eşlemesi.
 */
class MatchluckFailoverTest extends TestCase
{
    private function luckResponse(): array
    {
        return ['luck' => [
            'names' => ['White', 'Black'],
            'p0' => ['mwc_total' => 60.0, 'emg_total' => 0.5],
            'p1' => ['mwc_total' => 40.0, 'emg_total' => -0.5],
        ]];
    }

    public function test_matchluck_fails_over_when_heavy_instance_segfaults(): void
    {
        // Dedike heavy = 8098 (SEGV), son çare arka plan havuzu = 8092 (sağlam).
        config(['gnubg.heavy_urls' => 'http://127.0.0.1:8098', 'gnubg.analysis_urls' => 'http://127.0.0.1:8092']);
        Http::fake([
            // "Empty reply from server" = SEGV: bağlantı reddi değil ama cURL 52 -> ERİŞİLEMEZ (failover).
            '127.0.0.1:8098/matchluck' => fn () => throw new ConnectionException('cURL error 52: Empty reply from server'),
            '127.0.0.1:8092/matchluck' => Http::response($this->luckResponse(), 200),
        ]);

        $res = app(GnuBgClient::class)->matchluck("; [Match ID...]\n", false);

        $this->assertIsArray($res['luck'] ?? null, 'SEGV instance atlanıp sağlam yedekten luck dönmeli');
        $this->assertEqualsWithDelta(60.0, $res['luck']['p0']['mwc_total'], 1e-9, 'yedek instance sonucu gelmeli');
    }

    public function test_matchluck_returns_error_when_all_heavy_down(): void
    {
        config(['gnubg.heavy_urls' => 'http://127.0.0.1:8098', 'gnubg.analysis_urls' => '']);
        Http::fake([
            '127.0.0.1:8098/matchluck' => fn () => throw new ConnectionException('cURL error 52: Empty reply from server'),
        ]);

        $res = app(GnuBgClient::class)->matchluck("; mat\n", false);

        // Hepsi düştüyse 'luck' YOK -> job sessizce no-op eder (markUnavailable YOK, backfill ile tekrar).
        $this->assertNull($res['luck'] ?? null);
        $this->assertSame('heavy-unavailable', $res['error'] ?? null);
    }

    public function test_probe_heavy_engine_detects_segfault_despite_health_green(): void
    {
        $client = app(GnuBgClient::class);

        // /health yeşil ama matchluck SEGV -> motor DOWN (asıl olayın kör noktası).
        Http::fake([
            '127.0.0.1:8098/health' => Http::response(['ok' => true], 200),
            '127.0.0.1:8098/matchluck' => fn () => throw new ConnectionException('cURL error 52: Empty reply from server'),
        ]);
        $this->assertFalse($client->probeHeavyEngine('http://127.0.0.1:8098'), 'SEGV -> DOWN (health yeşil olsa da)');

        Http::fake(['127.0.0.1:8099/matchluck' => Http::response($this->luckResponse(), 200)]);
        $this->assertTrue($client->probeHeavyEngine('http://127.0.0.1:8099'), 'gerçek luck dönüyorsa UP');
    }

    public function test_unit_for_port_maps_only_known_units(): void
    {
        config(['gnubg.units' => 'gnubg-analysis,gnubg-analysis-heavy,gnubg-analysis-7']);
        $client = app(GnuBgClient::class);

        $this->assertSame('gnubg-analysis-7', $client->unitForPort(8098), '8098 -> 8091+7 -> gnubg-analysis-7');
        $this->assertSame('gnubg-analysis', $client->unitForPort(8092));
        $this->assertSame('gnubg-analysis-heavy', $client->unitForPort(8093));
        $this->assertNull($client->unitForPort(8099), 'GNUBG_UNITS\'te yoksa null (körlemesine restart yok)');
    }
}
