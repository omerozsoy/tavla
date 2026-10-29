<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Cihazdan-bağımsız tercih senkronu (users.prefs): /me/prefs merge + whitelist + /me dönüşü.
 * Amaç: web'de seçilen tahta/tema/ses app'te de gelsin (localStorage yerine hesaba bağlı).
 */
class PrefsTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'first_name' => 'p', 'last_name' => 'T', 'country' => '',
            'nickname' => 'p1', 'email' => 'p1@example.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    public function test_save_merges_and_filters_whitelist(): void
    {
        $u = $this->user();
        Sanctum::actingAs($u);

        // Geçerli anahtarlar + whitelist DIŞI bir anahtar (hacker.key atılmalı).
        $this->postJson('/api/me/prefs', ['prefs' => [
            'tavla.board' => 'galaxy',
            'tavla.theme' => 'dark',
            'hacker.key' => 'evil',
        ]])->assertOk()->assertJson(['prefs' => [
            'tavla.board' => 'galaxy',
            'tavla.theme' => 'dark',
        ]]);

        $u->refresh();
        $this->assertSame('galaxy', $u->prefs['tavla.board']);
        $this->assertArrayNotHasKey('hacker.key', $u->prefs);

        // İkinci çağrı MERGE eder (board'u ezmez), yeni anahtar ekler.
        $this->postJson('/api/me/prefs', ['prefs' => ['tavla.soundvol' => '0.5']])->assertOk();
        $u->refresh();
        $this->assertSame('galaxy', $u->prefs['tavla.board']);
        $this->assertSame('0.5', $u->prefs['tavla.soundvol']);

        // Boş/null = sil.
        $this->postJson('/api/me/prefs', ['prefs' => ['tavla.theme' => '']])->assertOk();
        $u->refresh();
        $this->assertArrayNotHasKey('tavla.theme', $u->prefs);

        // /me prefs'i döndürür (istemci hydrate eder). Anahtar düz string "tavla.board"
        // (nokta içerir) -> assertJsonPath nokta-yolu bunu iç içe sanır; array'i doğrudan oku.
        $me = $this->getJson('/api/me')->assertOk();
        $this->assertSame('galaxy', $me->json('user.prefs')['tavla.board']);
    }

    public function test_requires_auth(): void
    {
        $this->postJson('/api/me/prefs', ['prefs' => ['tavla.board' => 'x']])->assertUnauthorized();
    }
}
