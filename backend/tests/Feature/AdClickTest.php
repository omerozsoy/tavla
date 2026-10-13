<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// "Saka reklami" tiklama kaydi: kullanici basina tek satir (dedup) + tiklayan adlari listesi.
class AdClickTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    public function test_click_dedups_per_user_and_clickers_lists_names(): void
    {
        $a = $this->user('Ahmet');
        $b = $this->user('Mehmet');

        Sanctum::actingAs($a);
        $this->postJson('/api/ad-slots/1/click')->assertOk();
        $this->postJson('/api/ad-slots/1/click')->assertOk(); // ikinci tik -> yine tek satir

        Sanctum::actingAs($b);
        $this->postJson('/api/ad-slots/1/click')->assertOk();

        $this->assertDatabaseCount('ad_clicks', 2);

        $res = $this->getJson('/api/ad-slots/1/clickers')->assertOk();
        $res->assertJsonPath('count', 2);
        $this->assertEqualsCanonicalizing(['Ahmet', 'Mehmet'], $res->json('names'));
    }

    public function test_guest_click_is_not_recorded(): void
    {
        $this->postJson('/api/ad-slots/1/click')->assertOk();
        $this->assertDatabaseCount('ad_clicks', 0);
    }
}
