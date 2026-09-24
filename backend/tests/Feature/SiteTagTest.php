<?php

namespace Tests\Feature;

use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Google Etiketi (gtag) yapilandirmasi /api/site-tags: aktif+id doluysa doner; kapali/id bos -> null.
class SiteTagTest extends TestCase
{
    use RefreshDatabase;

    public function test_enabled_with_id_returns_config(): void
    {
        Setting::put('gtag_enabled', '1');
        Setting::put('gtag_id', 'AW-18472158080');

        $this->getJson('/api/site-tags')
            ->assertOk()
            ->assertJson(['gtag' => ['enabled' => true, 'id' => 'AW-18472158080']]);
    }

    public function test_disabled_returns_null_id(): void
    {
        Setting::put('gtag_enabled', '0');
        Setting::put('gtag_id', 'AW-18472158080');

        $this->getJson('/api/site-tags')
            ->assertOk()
            ->assertJson(['gtag' => ['enabled' => false, 'id' => null]]);
    }

    public function test_enabled_but_empty_id_is_treated_disabled(): void
    {
        Setting::put('gtag_enabled', '1');
        Setting::put('gtag_id', '');

        $this->getJson('/api/site-tags')
            ->assertOk()
            ->assertJson(['gtag' => ['enabled' => false, 'id' => null]]);
    }

    public function test_seed_migration_enables_provided_tag(): void
    {
        // Migration (2026_09_24_140000) RefreshDatabase ile calisti -> tohum aktif olmali.
        $this->getJson('/api/site-tags')
            ->assertOk()
            ->assertJson(['gtag' => ['enabled' => true, 'id' => 'AW-18472158080']]);
    }
}
