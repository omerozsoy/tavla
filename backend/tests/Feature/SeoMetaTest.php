<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SeoMetaTest extends TestCase
{
    public function test_account_route_is_not_indexable(): void
    {
        $this->get('/giris')
            ->assertOk()
            ->assertSee('name="robots" content="noindex, follow"', false);
    }

    public function test_public_landing_route_remains_indexable(): void
    {
        $this->get('/online-tavla')
            ->assertOk()
            ->assertSee('name="robots" content="index, follow"', false)
            ->assertSee('Online Tavla Oyna - Ücretsiz Canlı Tavla | TavlaTv', false)
            ->assertSee('<h2>Online tavla nasıl oynanır?</h2>', false)
            ->assertSee('Gerçek rakiplerle canlı maçlara katılabilir', false)
            ->assertSee('"@type":"WebPage"', false)
            ->assertSee('"url":"https://www.tavlatv.com/online-tavla"', false)
            ->assertSee('href="/tavla-rehberi"', false)
            ->assertSee('"@type":"BreadcrumbList"', false);
    }

    public function test_tournament_landing_contains_keyword_relevant_content(): void
    {
        $this->get('/turnuva-takvimi')
            ->assertOk()
            ->assertSee('<h2>Yaklaşan tavla turnuvaları ve takvim</h2>', false)
            ->assertSee('Tavla turnuvası tarihleri', false)
            ->assertSee('name="robots" content="index, follow"', false);
    }

    public function test_unknown_content_slug_is_a_noindex_404(): void
    {
        $this->get('/haberler/olmayan-seo-yazisi-12345')
            ->assertNotFound()
            ->assertSee('name="robots" content="noindex, follow"', false);
    }

    public function test_published_news_gets_article_structured_data(): void
    {
        if (! Schema::hasTable('contents')) {
            Schema::create('contents', function ($table): void {
                $table->id();
                $table->string('type')->nullable();
                $table->string('title')->nullable();
                $table->text('body')->nullable();
                $table->string('image')->nullable();
                $table->timestamp('event_at')->nullable();
                $table->boolean('published')->default(true);
                $table->timestamps();
            });
        }

        DB::table('contents')->insert([
            'type' => 'news',
            'title' => 'SEO Haber Denemesi',
            'body' => 'Yayınlanmış haber açıklaması.',
            'published' => true,
            'event_at' => '2026-09-20 12:00:00',
        ]);

        try {
            $this->get('/haberler/seo-haber-denemesi')
                ->assertOk()
                ->assertSee('"@type":"Article"', false)
                ->assertSee('"datePublished":"2026-09-20T12:00:00+00:00"', false)
                ->assertSee('https://www.tavlatv.com/og-image.png', false)
                ->assertSee('SEO Haber Denemesi', false);
        } finally {
            Schema::dropIfExists('contents');
        }
    }

    public function test_sitemap_urls_are_indexable_and_canonical(): void
    {
        $sitemap = file_get_contents(public_path('sitemap.xml'));
        $this->assertNotFalse($sitemap);
        preg_match_all('~<loc>(https://www\\.tavlatv\\.com/[^<]*)</loc>~', (string) $sitemap, $matches);
        $this->assertNotEmpty($matches[1]);

        foreach ($matches[1] as $url) {
            $path = parse_url($url, PHP_URL_PATH) ?: '/';
            $response = $this->get($path);
            $response->assertOk();
            $response->assertSee('name="robots" content="index, follow"', false);
            $response->assertSee('rel="canonical" href="' . $url . '"', false);
        }
    }

    public function test_sitemap_command_includes_only_published_news(): void
    {
        if (! Schema::hasTable('contents')) {
            Schema::create('contents', function ($table): void {
                $table->id();
                $table->string('type')->nullable();
                $table->string('title')->nullable();
                $table->text('body')->nullable();
                $table->string('image')->nullable();
                $table->timestamp('event_at')->nullable();
                $table->boolean('published')->default(true);
                $table->timestamps();
            });
        }

        DB::table('contents')->insert([
            ['type' => 'news', 'title' => 'Yayınlanan Turnuva Haberi', 'published' => true],
            ['type' => 'news', 'title' => 'Taslak Turnuva Haberi', 'published' => false],
        ]);

        try {
            $this->artisan('seo:sitemap', ['--dry-run' => true])
                ->expectsOutputToContain('/haberler/yayinlanan-turnuva-haberi')
                ->doesntExpectOutputToContain('/haberler/taslak-turnuva-haberi')
                ->assertExitCode(0);
        } finally {
            Schema::dropIfExists('contents');
        }
    }
}
