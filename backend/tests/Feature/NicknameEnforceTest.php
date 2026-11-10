<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * tavla:nickname-enforce — küfürlü takma ad son-tarih nöbetçisi:
 *  süre dolan + hâlâ uygunsuz -> kapat; düzeltilmiş -> uyarı temizlenir; süre gelmemiş -> bekle.
 */
class NicknameEnforceTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com', 'password' => bcrypt('secret123'),
        ]);
    }

    public function test_overdue_profane_nickname_gets_banned(): void
    {
        $u = $this->user('siktirgit');
        $u->forceFill(['nickname_warned_at' => now()->subDay(), 'nickname_ban_at' => now()->subHour()])->save();

        $this->artisan('tavla:nickname-enforce')->assertSuccessful();

        $this->assertNotNull($u->fresh()->banned_at);
    }

    public function test_corrected_nickname_clears_warning_without_ban(): void
    {
        $u = $this->user('temizisim');
        // Uyarı verilmiş (eski kirli adından), ama kullanıcı artık temiz bir ad kullanıyor.
        $u->forceFill(['nickname_warned_at' => now()->subDay(), 'nickname_ban_at' => now()->subHour()])->save();

        $this->artisan('tavla:nickname-enforce')->assertSuccessful();

        $fresh = $u->fresh();
        $this->assertNull($fresh->banned_at);
        $this->assertNull($fresh->nickname_ban_at);
        $this->assertNull($fresh->nickname_warned_at);
    }

    public function test_future_deadline_is_left_alone(): void
    {
        $u = $this->user('amkpro');
        $u->forceFill(['nickname_warned_at' => now(), 'nickname_ban_at' => now()->addHours(12)])->save();

        $this->artisan('tavla:nickname-enforce')->assertSuccessful();

        $fresh = $u->fresh();
        $this->assertNull($fresh->banned_at);          // süre gelmemiş -> ban yok
        $this->assertNotNull($fresh->nickname_ban_at); // uyarı duruyor
    }

    // Elle eklenen (filtreye TAKILMAYAN temiz ad) ama ad DEĞİŞMEMİŞ -> süre dolunca banlanır.
    public function test_manual_entry_banned_when_nickname_unchanged(): void
    {
        $u = $this->user('TemizAmaUygunsuz');
        $u->forceFill([
            'nickname_warned_at' => now()->subDay(),
            'nickname_ban_at' => now()->subHour(),
            'nickname_warned_nick' => 'TemizAmaUygunsuz', // uyarı anındaki ad = şu anki ad
        ])->save();

        $this->artisan('tavla:nickname-enforce')->assertSuccessful();

        $this->assertNotNull($u->fresh()->banned_at);
    }

    // Takma ad uyarıdan bu yana DEĞİŞMİŞ -> ban yok, uyarı temizlenir (yeni ad kirli olsa bile).
    public function test_changed_nickname_clears_warning(): void
    {
        $u = $this->user('yenisikik'); // yeni ad hâlâ filtreye takılır
        $u->forceFill([
            'nickname_warned_at' => now()->subDay(),
            'nickname_ban_at' => now()->subHour(),
            'nickname_warned_nick' => 'eskiuygunsuzad', // farklı -> değişmiş
        ])->save();

        $this->artisan('tavla:nickname-enforce')->assertSuccessful();

        $fresh = $u->fresh();
        $this->assertNull($fresh->banned_at);
        $this->assertNull($fresh->nickname_ban_at);
        $this->assertNull($fresh->nickname_warned_nick);
    }
}
