<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * SPA ilk-segment allowlist'i (routes/web.php $valid) App.tsx applyFromPath switch'i ile
 * senkron olmalı. Yeni menü slug'ı eklenip buraya eklenmezse doğrudan link/yenileme 404 döner
 * ("hiç bişi olmuyor" bug'ı: turkiye-online-tavla-ligi + takimlar-ligi allowlist dışıydı).
 */
class SpaFallbackRouteTest extends TestCase
{
    public function test_league_and_teams_routes_serve_spa_shell_not_404(): void
    {
        foreach (['turkiye-online-tavla-ligi', 'takimlar-ligi', 'turkiye-online-tavla-ligi/5', 'duello'] as $slug) {
            $res = $this->get('/'.$slug);
            $res->assertStatus(200);
            $res->assertDontSee('Sayfa Bulunamadı');
        }
    }
}
