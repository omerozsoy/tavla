<?php

namespace Tests\Feature;

use App\Models\Content;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Makale/Haber okunma sayaci: yeni yazi 40-150 arasi rastgele baslar; detay acilinca +1;
// yayinsiz/ilgisiz tur no-op. (Kullanici direktifi.)
class ContentViewsTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_makale_starts_between_40_and_150(): void
    {
        $c = Content::create(['type' => 'makale', 'title' => 'Test', 'body' => 'x', 'sort' => 0, 'published' => true]);
        $this->assertGreaterThanOrEqual(40, (int) $c->views);
        $this->assertLessThanOrEqual(150, (int) $c->views);
    }

    public function test_new_news_starts_between_40_and_150(): void
    {
        $c = Content::create(['type' => 'news', 'title' => 'Haber', 'body' => 'x', 'sort' => 0, 'published' => true]);
        $this->assertGreaterThanOrEqual(40, (int) $c->views);
        $this->assertLessThanOrEqual(150, (int) $c->views);
    }

    public function test_other_type_does_not_get_random_views(): void
    {
        $c = Content::create(['type' => 'service', 'title' => 'Hizmet', 'body' => 'x', 'sort' => 0, 'published' => true]);
        $this->assertSame(0, (int) $c->views);
    }

    public function test_view_endpoint_increments_published_makale(): void
    {
        $c = Content::create(['type' => 'makale', 'title' => 'M', 'body' => 'x', 'sort' => 0, 'published' => true]);
        $start = (int) $c->views;

        $this->postJson("/api/contents/{$c->id}/view")
            ->assertOk()
            ->assertJson(['views' => $start + 1]);

        $this->assertSame($start + 1, (int) $c->fresh()->views);
    }

    public function test_view_endpoint_is_noop_for_unpublished(): void
    {
        $c = Content::create(['type' => 'makale', 'title' => 'Taslak', 'body' => 'x', 'sort' => 0, 'published' => false]);
        // Taslak (published=false) -> creating hook makale icin yine 40-150 verir; ama view artmaz.
        $start = (int) $c->views;

        $this->postJson("/api/contents/{$c->id}/view")
            ->assertOk()
            ->assertJson(['views' => $start]); // degismedi

        $this->assertSame($start, (int) $c->fresh()->views);
    }

    public function test_index_exposes_views(): void
    {
        Content::create(['type' => 'makale', 'title' => 'Liste', 'body' => 'x', 'sort' => 0, 'published' => true]);
        $this->getJson('/api/contents?type=makale')
            ->assertOk()
            ->assertJsonStructure(['items' => [['id', 'title', 'views']]]);
    }
}
