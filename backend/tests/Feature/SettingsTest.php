<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Site Ayarları (Setting): admin değeri kaydı yoksa varsayılana düşer, kayıt varsa onu kullanır
// (cache put'ta temizlenir). Ekonomi değerleri (komisyon, hoşgeldin, rating) buradan yönetilir.
class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_int_fallback_and_override_with_cache(): void
    {
        $this->assertSame(5, Setting::int('commission_pct', 5)); // kayıt yok -> default
        Setting::put('commission_pct', 20);
        $this->assertSame(20, Setting::int('commission_pct', 5)); // kayıt var -> 20 (cache tazelendi)
        $this->assertSame(1400, Setting::int('missing_key', 1400)); // bilinmeyen -> default
    }

    public function test_commission_setting_drives_settle(): void
    {
        // Admin komisyonu %20 yaparsa settle onu kullanır (config değil).
        Setting::put('commission_pct', 20);
        $p1 = User::create(['first_name' => 'W', 'last_name' => 'T', 'country' => '', 'nickname' => 'sw', 'email' => 'sw@e.com', 'password' => bcrypt('secret123')]);
        $p2 = User::create(['first_name' => 'L', 'last_name' => 'T', 'country' => '', 'nickname' => 'sl', 'email' => 'sl@e.com', 'password' => bcrypt('secret123')]);
        $p1->coins = 100;
        $p1->save();
        $p2->coins = 100;
        $p2->save();
        Room::create([
            'code' => 'SET1', 'p1_token' => 'tok1', 'p1_user_id' => $p1->id, 'p1_name' => 'sw',
            'p2_token' => 'tok2', 'p2_user_id' => $p2->id, 'p2_name' => 'sl',
            'status' => 'playing', 'stake' => 100, 'bet_pct' => 0, 'version' => 1, 'settled' => false,
            'authoritative' => true, 'server_match' => ['done' => true, 'winner' => 'white'],
        ]);

        Sanctum::actingAs($p1);
        $this->postJson('/api/rooms/SET1/settle', ['token' => 'tok1', 'won' => true])
            ->assertOk()->assertJsonPath('won_amount', 80)->assertJsonPath('commission', 20);
        $this->assertSame(180, (int) $p1->fresh()->coins); // 100 + 80
    }
}
