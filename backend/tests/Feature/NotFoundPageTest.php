<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Bilinmeyen yollar için markalı 404 sayfası (soft-404 yerine gerçek 404 + noindex + geri linkler).
class NotFoundPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_route_returns_branded_404(): void
    {
        $this->get('/boyle-bir-sayfa-yok-12345')
            ->assertStatus(404)
            ->assertSee('Sayfa Bulunamadı', false)
            ->assertSee('name="robots" content="noindex, follow"', false)
            ->assertSee('href="/tavla-oyna"', false)
            ->assertSee('href="/nasil-oynanir"', false);
    }

    public function test_unknown_dynamic_slug_returns_branded_404(): void
    {
        $this->get('/haberler/olmayan-bir-haber-98765')
            ->assertStatus(404)
            ->assertSee('Sayfa Bulunamadı', false);
    }

    public function test_file_like_unknown_stays_plain_404(): void
    {
        // Uzantılı istek (silinmiş chunk vb.) markalı HTML DEĞİL, düz 404 döner.
        $this->get('/olmayan-dosya.js')->assertStatus(404);
        $this->get('/olmayan-dosya.js')->assertDontSee('Sayfa Bulunamadı', false);
    }

    public function test_known_route_is_not_404(): void
    {
        // Bilinen rota markalı 404 DÖNMEZ (SPA kabuğu ya da build-eksik mesajı; 404 değil).
        $res = $this->get('/online-tavla');
        $this->assertNotSame(404, $res->getStatusCode());
        $res->assertDontSee('Sayfa Bulunamadı', false);
    }
}
