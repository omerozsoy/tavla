<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\TournamentAd;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Turnuva reklamlari ANA KAPATMA (/admin/tournament-ads tek dugme): Setting
 * tournament_ads_enabled=0 iken /api/tournament-ads bos doner (hicbir banner gosterilmez),
 * kayitlar silinmeden. Varsayilan (ayar yok) = acik.
 */
class TournamentAdToggleTest extends TestCase
{
    use RefreshDatabase;

    public function test_ads_shown_by_default(): void
    {
        TournamentAd::create(['image' => 'reklam/a.png', 'published' => true]);

        $this->getJson('/api/tournament-ads')
            ->assertOk()
            ->assertJsonCount(1, 'ads');
    }

    public function test_master_switch_hides_all_ads(): void
    {
        TournamentAd::create(['image' => 'reklam/a.png', 'published' => true]);
        Setting::put('tournament_ads_enabled', 0);

        $this->getJson('/api/tournament-ads')
            ->assertOk()
            ->assertJsonCount(0, 'ads');

        // Kayit SILINMEDI -> tekrar acilinca geri gelir.
        $this->assertDatabaseCount('tournament_ads', 1);
        Setting::put('tournament_ads_enabled', 1);
        $this->getJson('/api/tournament-ads')->assertOk()->assertJsonCount(1, 'ads');
    }
}
