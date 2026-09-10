<?php

namespace Tests\Feature;

use App\Models\CookieConsentSetting;
use App\Models\CookieEntry;
use App\Models\InfoPage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Hukuki sayfalar (info_pages icinde, "Bilgi Sayfalari" altindan yonetilir) + cerez uc
 * noktalari. Seed migration RefreshDatabase ile calisir.
 */
class LegalCookieTest extends TestCase
{
    use RefreshDatabase;

    public function test_legal_pages_seeded_into_info_pages(): void
    {
        foreach (InfoPage::LEGAL_SLUGS as $slug) {
            $this->assertTrue(InfoPage::where('slug', $slug)->exists(), "eksik hukuki sayfa: $slug");
        }
        $this->assertGreaterThanOrEqual(1, CookieEntry::count());
        $this->assertSame(1, CookieConsentSetting::count());
    }

    public function test_legal_index_lists_active_pages(): void
    {
        $slugs = collect($this->getJson('/api/legal-pages')->assertOk()->json('pages'))->pluck('slug');
        foreach (InfoPage::LEGAL_SLUGS as $s) {
            $this->assertTrue($slugs->contains($s), "eksik slug: $s");
        }
    }

    public function test_info_index_excludes_legal_pages(): void
    {
        // Bilgi modali fetch'i hukuki sayfalari ICERMEMELI.
        $slugs = collect($this->getJson('/api/info-pages')->assertOk()->json('pages'))->pluck('slug');
        foreach (InfoPage::LEGAL_SLUGS as $s) {
            $this->assertFalse($slugs->contains($s), "hukuki sayfa /info-pages'te cikmamali: $s");
        }
    }

    public function test_legal_show_returns_body_and_404_for_unknown(): void
    {
        $this->getJson('/api/legal-pages/kvkk')->assertOk()
            ->assertJsonPath('page.slug', 'kvkk')
            ->assertJsonPath('page.title', 'Kişisel Verilerin Korunması ve Aydınlatma Metni');
        $this->assertNotEmpty($this->getJson('/api/legal-pages/kvkk')->json('page.body'));

        $this->getJson('/api/legal-pages/yok-boyle')->assertStatus(404)->assertJsonPath('page', null);
        // Hukuki olmayan bir bilgi slug'i /legal-pages'ten servis EDILMEZ.
        $this->getJson('/api/legal-pages/about')->assertStatus(404);
    }

    public function test_inactive_legal_page_hidden(): void
    {
        InfoPage::where('slug', 'kvkk')->update(['published' => false]);
        $this->getJson('/api/legal-pages/kvkk')->assertStatus(404);
        $slugs = collect($this->getJson('/api/legal-pages')->json('pages'))->pluck('slug');
        $this->assertFalse($slugs->contains('kvkk'));
    }

    public function test_cookies_endpoint_returns_active_rows(): void
    {
        $rows = $this->getJson('/api/cookies')->assertOk()->json('cookies');
        $this->assertNotEmpty($rows);
        $this->assertArrayHasKey('category', $rows[0]);
    }

    public function test_cookie_consent_config(): void
    {
        $this->getJson('/api/cookie-consent')->assertOk()
            ->assertJsonPath('consent.consent_version', 1)
            ->assertJsonPath('consent.banner_title', 'Çerez Tercihleriniz')
            ->assertJsonStructure(['consent' => ['categories' => ['necessary', 'functional', 'analytics', 'marketing'], 'ga_id', 'gtm_id', 'meta_pixel_id']]);
    }
}
