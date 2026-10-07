<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * KLASIK TAVLA sunucu-otoritesi (uçtan uca): (1) küp teklifi HER ZAMAN reddedilir (CLASSIC_NO_CUBE),
 * (2) oyun-sonu puanı mars=2 ile sınırlı — kaybeden barda olsa bile backgammon-3 yazılmaz.
 * AuthoritativeLoopTest deseniyle; validator Http::fake ile taklit edilir.
 */
class ClassicTavlaTest extends TestCase
{
    use RefreshDatabase;

    private ?User $p1 = null;
    private ?User $p2 = null;

    private function command(string $token, string $uri, array $payload = []): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs($token === 'p1' ? $this->p1 : $this->p2);
        return $this->postJson($uri, array_merge([
            'token' => $token,
            'command_id' => (string) Str::uuid(),
            'expected_version' => (int) Room::first()->fresh()->server_version,
        ], $payload));
    }

    private function room(int $target = 5): Room
    {
        $this->p1 = User::factory()->create(['id' => 10]);
        $this->p2 = User::factory()->create(['id' => 20]);
        return Room::create([
            'code' => 'CLSSX',
            'p1_token' => 'p1', 'p1_name' => 'W', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20,
            'status' => 'playing', 'version' => 0, 'target' => $target,
            'authoritative' => true,
            'classic' => true, // KLASIK TAVLA
        ]);
    }

    /** [starterColor, starterToken, otherColor, otherToken] */
    private function openingRoll(): array
    {
        $r = $this->command('p1', '/api/rooms/CLSSX/roll')->assertOk();
        $starter = $r->json('starter');

        return $starter === 'white'
            ? ['white', 'p1', 'black', 'p2']
            : ['black', 'p2', 'white', 'p1'];
    }

    private function fake(array $state): void
    {
        Http::fake(['validator.test/validate' => fn () => Http::response(['valid' => true, 'state' => $state])]);
    }

    public function test_cube_offer_rejected_in_classic(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 5);
        [, $starterTok, $otherColor, $otherTok] = $this->openingRoll();

        // Açılış eli oynanır (tur sayacı 1 -> normalde küp teklif edilebilirdi).
        $flip = Backgammon::initialState();
        $flip['turn'] = $otherColor;
        $flip['dice'] = [];
        $this->fake($flip);
        $this->command($starterTok, '/api/rooms/CLSSX/move', ['steps' => [['from' => 5, 'to' => 2, 'die' => 3]]])->assertOk();

        // Klasik modda küp teklifi REDDEDİLİR (normal maçta bu noktada kabul edilirdi).
        $this->command($otherTok, '/api/rooms/CLSSX/cube/offer')
            ->assertStatus(409)
            ->assertJsonPath('reason', 'CLASSIC_NO_CUBE');
        $this->assertNull(Room::first()->fresh()->server_match['cube']['pending']);
    }

    public function test_mars_capped_at_two_even_with_loser_on_bar(): void
    {
        config()->set('validator.url', 'http://validator.test');
        $this->room(target: 5);
        [$starterColor, $starterTok, $otherColor, ] = $this->openingRoll();

        // Başlayan 15 taşı toplar; KAYBEDEN BARDA (normal maçta backgammon=3 olurdu).
        $flip = Backgammon::initialState();
        $flip['turn'] = $otherColor;
        $flip['dice'] = [];
        $flip['off'] = ['white' => 0, 'black' => 0, $starterColor => 15];
        $flip['bar'] = ['white' => 0, 'black' => 0, $otherColor => 1];
        $this->fake($flip);

        $res = $this->command($starterTok, '/api/rooms/CLSSX/move', ['steps' => [['from' => 1, 'to' => 'off', 'die' => 1]]])
            ->assertOk();
        $res->assertJsonPath('winner', $starterColor);

        $sm = Room::first()->fresh()->server_match;
        // Klasik: mars = 2 (backgammon-3 DEĞİL). Küp=1 -> skor tam 2.
        $this->assertSame(2, (int) $sm['score'][$starterColor]);
    }
}
