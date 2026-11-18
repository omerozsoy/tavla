<?php

namespace Tests\Feature;

use App\Models\OpeningPosition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Açılış pratiği havuzu: openings:import CSV.gz'den yükler (board+zar başına TEK temsilci,
 * xgid UNIQUE = çift dizilim yok), counts + sayfalı index halka açık uçları çalışır.
 */
class OpeningPositionTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_loads_unique_positions_and_endpoints_work(): void
    {
        Artisan::call('openings:import'); // seed-migration testte atlar; burada elle çağrılır

        $total = OpeningPosition::count();
        $this->assertGreaterThan(80000, $total, 'havuz yüklenmeli (~84k)');
        // çift dizilim yok: benzersiz xgid == toplam
        $this->assertSame($total, OpeningPosition::distinct('xgid')->count('xgid'));
        // her satırda otoriter hamle var
        $this->assertSame(0, OpeningPosition::where('answer', '')->count());

        // counts: band => sayı, toplam == total
        $counts = $this->getJson('/api/opening-positions/counts')->assertOk()->json();
        $this->assertSame($total, array_sum($counts));

        // index: band sayfası, per cap'li, stabil
        $res = $this->getJson('/api/opening-positions?band=orta&page=1&per=10')->assertOk();
        $items = $res->json('items');
        $this->assertCount(10, $items);
        $this->assertArrayHasKey('xgid', $items[0]);
        $this->assertArrayHasKey('answer', $items[0]);

        // sayfa 2 farklı pozisyonlar (çakışma yok)
        $p2 = $this->getJson('/api/opening-positions?band=orta&page=2&per=10')->json('items');
        $this->assertEmpty(array_intersect(
            array_column($items, 'xgid'),
            array_column($p2, 'xgid'),
        ));

        // geçersiz band 422
        $this->getJson('/api/opening-positions?band=yok')->assertStatus(422);
    }
}
