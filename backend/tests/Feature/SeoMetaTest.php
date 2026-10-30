<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Support\SeoMeta;
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
            ->assertSee('"url":"https://tavlatv.com/online-tavla"', false)
            ->assertSee('href="/tavla-rehberi"', false)
            ->assertSee('"@type":"BreadcrumbList"', false);
    }

    public function test_backgammon_landing_is_english_with_hreflang_and_game_schema(): void
    {
        $this->get('/backgammon')
            ->assertOk()
            ->assertSee('name="robots" content="index, follow"', false)
            ->assertSee('Play Backgammon Online Free - Live Multiplayer | TavlaTv', false)
            ->assertSee('<html lang="en"', false)
            ->assertSee('property="og:locale" content="en_US"', false)
            ->assertSee('rel="alternate" hreflang="en" href="https://gammontv.com/backgammon"', false)
            ->assertSee('rel="alternate" hreflang="tr" href="https://tavlatv.com/online-tavla"', false)
            ->assertSee('rel="alternate" hreflang="x-default" href="https://tavlatv.com/online-tavla"', false)
            ->assertSee('rel="canonical" href="https://tavlatv.com/backgammon"', false)
            ->assertSee('"@type":"VideoGame"', false)
            ->assertSee('"inLanguage":"en"', false)
            ->assertSee('Play backgammon online for free', false);
    }

    public function test_online_tavla_has_reciprocal_hreflang_to_backgammon(): void
    {
        $this->get('/online-tavla')
            ->assertOk()
            ->assertSee('rel="alternate" hreflang="en" href="https://gammontv.com/backgammon"', false)
            ->assertSee('rel="alternate" hreflang="tr" href="https://tavlatv.com/online-tavla"', false);
    }

    public function test_tournament_landing_contains_keyword_relevant_content(): void
    {
        $this->get('/turnuva-takvimi')
            ->assertOk()
            ->assertSee('<h2>Yaklaşan tavla turnuvaları ve takvim</h2>', false)
            ->assertSee('Tavla turnuvası tarihleri', false)
            ->assertSee('name="robots" content="index, follow"', false);
    }

    public function test_guide_structured_data_has_image_and_publisher_logo(): void
    {
        $this->get('/tavla-rehberi/tavla-acilis-stratejileri')
            ->assertOk()
            ->assertSee('"@type":"BlogPosting"', false)
            ->assertSee('https://tavlatv.com/og-image.jpg', false)
            ->assertSee('https://tavlatv.com/icon-512.png', false)
            ->assertSee('"datePublished":"2026-09-22T18:24:48+03:00"', false)
            ->assertSee('"dateModified":"2026-09-22T18:24:48+03:00"', false);
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
                ->assertSee('"datePublished":"2026-09-20T12:00:00+03:00"', false) // app.timezone Europe/Istanbul
                ->assertSee('https://tavlatv.com/og-image.jpg', false)
                ->assertSee('SEO Haber Denemesi', false);
        } finally {
            Schema::dropIfExists('contents');
        }
    }

    public function test_sitemap_urls_are_indexable_and_canonical(): void
    {
        $sitemap = file_get_contents(public_path('sitemap.xml'));
        $this->assertNotFalse($sitemap);
        preg_match_all('~<loc>(https://tavlatv\\.com/[^<]*)</loc>~', (string) $sitemap, $matches);
        $this->assertNotEmpty($matches[1]);
        $sitemapUrls = array_fill_keys($matches[1], true);

        foreach (SeoMeta::indexableUrls() as $url) {
            $this->assertArrayHasKey($url, $sitemapUrls, "Indexable SEO URL is missing from sitemap: {$url}");
        }

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

    public function test_homepage_and_public_route_have_game_structured_data(): void
    {
        $homepage = file_get_contents(public_path('index.html'));
        $this->assertNotFalse($homepage);
        $this->assertStringContainsString('"@type": "VideoGame"', (string) $homepage);
        $this->assertStringContainsString('"applicationCategory": "Game"', (string) $homepage);

        $this->get('/online-tavla')
            ->assertOk()
            ->assertSee('"@type":"WebPage"', false)
            ->assertSee('"isPartOf":{"@type":"WebSite"', false);
    }

    // ───────────── Çoklu-domain (GammonTV / İngilizce) ─────────────

    public function test_brand_resolves_from_host(): void
    {
        $this->assertSame('tavla', \App\Support\Brand::keyFromHost('tavlatv.com'));
        $this->assertSame('tavla', \App\Support\Brand::keyFromHost('tavlatv.com'));
        $this->assertSame('gammon', \App\Support\Brand::keyFromHost('gammontv.com'));
        $this->assertSame('gammon', \App\Support\Brand::keyFromHost('gammontv.com'));
        $this->assertSame('tavla', \App\Support\Brand::keyFromHost('localhost')); // varsayılan
        $this->assertSame('en', \App\Support\Brand::fromHost('gammontv.com')['locale']);
        $this->assertSame('tr', \App\Support\Brand::fromHost('tavlatv.com')['locale']);
    }

    public function test_gammon_host_serves_english_branded_landing(): void
    {
        $this->get('http://gammontv.com/online-tavla')
            ->assertOk()
            ->assertSee('Play Backgammon Online - Free Live Backgammon | GammonTV', false)
            ->assertSee('<html lang="en"', false)
            ->assertSee('property="og:locale" content="en_US"', false)
            ->assertSee('rel="canonical" href="https://gammontv.com/online-tavla"', false)
            ->assertSee('property="og:site_name" content="GammonTV"', false)
            ->assertSee('rel="manifest" href="/manifest.en.webmanifest"', false)
            ->assertSee('Play Backgammon Online</a>', false); // noscript nav İngilizce
        // NOT: tavlatv.com çapraz-domain hreflang'da (tr alternatifi) KASITLI görünür — leak değil.
    }

    public function test_tavla_host_still_turkish_and_unchanged(): void
    {
        // Regresyon: varsayılan marka (tavlatv) eskisi gibi Türkçe + tavlatv kanonik.
        $this->get('http://tavlatv.com/online-tavla')
            ->assertOk()
            ->assertSee('Online Tavla Oyna - Ücretsiz Canlı Tavla | TavlaTv', false)
            ->assertSee('<html lang="tr"', false)
            ->assertSee('property="og:locale" content="tr_TR"', false)
            ->assertSee('rel="canonical" href="https://tavlatv.com/online-tavla"', false)
            // NOT: tavla /online-tavla artık çapraz-domain reciprocal hreflang en -> gammontv.com
            // İÇERİR (kasıtlı); eski assertDontSee('gammontv.com') kaldırıldı.
            ->assertSee('rel="alternate" hreflang="en" href="https://gammontv.com/backgammon"', false);
    }

    public function test_gammon_homepage_is_english(): void
    {
        $this->get('http://gammontv.com/')
            ->assertOk()
            ->assertSee('GammonTV — Play Backgammon Online Free | Live Multiplayer', false)
            ->assertSee('<html lang="en"', false)
            ->assertSee('"name":"GammonTV"', false)
            ->assertSee('rel="canonical" href="https://gammontv.com/"', false);
    }

    public function test_cross_domain_hreflang_on_standard_route(): void
    {
        $this->get('http://gammontv.com/turnuva-takvimi')
            ->assertOk()
            ->assertSee('rel="alternate" hreflang="tr" href="https://tavlatv.com/turnuva-takvimi"', false)
            ->assertSee('rel="alternate" hreflang="en" href="https://gammontv.com/turnuva-takvimi"', false);
    }

    public function test_host_aware_robots_and_sitemap(): void
    {
        $this->get('http://gammontv.com/robots.txt')
            ->assertOk()
            ->assertSee('Sitemap: https://gammontv.com/sitemap.xml', false);

        $this->get('http://tavlatv.com/robots.txt')
            ->assertOk()
            ->assertSee('Sitemap: https://tavlatv.com/sitemap.xml', false);

        $this->get('http://gammontv.com/sitemap.xml')
            ->assertOk()
            ->assertSee('<loc>https://gammontv.com/online-tavla</loc>', false);
    }
}
