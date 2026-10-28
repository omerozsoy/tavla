<?php

namespace Tests\Feature;

use App\Filament\Pages\BanKacaklari;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Ban Kaçakları: yasaklı bir hesapla aynı IP'den giren YASAKSIZ hesapları bulur (ban-evasion).
 */
class BanKacaklariTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n): User
    {
        return User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => '',
            'nickname' => $n, 'email' => $n.'@example.com', 'password' => bcrypt('secret123'),
        ]);
    }

    private function presence(User $u, string $ip): void
    {
        DB::table('shield_presence')->insert([
            'subject' => 'u:'.$u->id, 'user_id' => $u->id, 'ip' => $ip,
            'last_seen_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_fresh_account_sharing_ip_with_banned_is_flagged_after_ban(): void
    {
        $banned = $this->user('eskiyasakli');
        $banned->forceFill(['banned_at' => now()->subDays(3), 'ban_reason' => 'hile'])->save();
        $fresh = $this->user('yenihesap'); // created_at = now -> yasaktan SONRA
        $this->presence($banned, '1.2.3.4');
        $this->presence($fresh, '1.2.3.4');

        $rows = (new BanKacaklari)->suspects();

        $this->assertCount(1, $rows);
        $this->assertSame($fresh->id, $rows[0]['user']['id']);
        $this->assertTrue($rows[0]['anyAfterBan'], 'yeni hesap yasaktan sonra açılmış -> güçlü sinyal');
        $this->assertSame($banned->id, $rows[0]['links'][0]['bannedId']);
        $this->assertSame(['1.2.3.4'], $rows[0]['links'][0]['ips']);
    }

    public function test_fresh_account_on_unrelated_ip_is_not_listed(): void
    {
        $banned = $this->user('eskiyasakli');
        $banned->forceFill(['banned_at' => now()->subDay(), 'ban_reason' => 'hile'])->save();
        $fresh = $this->user('masum');
        $this->presence($banned, '1.2.3.4');
        $this->presence($fresh, '9.9.9.9'); // farklı IP -> bağ yok

        $this->assertCount(0, (new BanKacaklari)->suspects());
    }

    public function test_banned_ip_recovered_from_shield_events_history(): void
    {
        // Senaryo: yasaklının presence'ı budanmış, IP'si yalnız shield_events'te kalmış (kalıcı iz).
        $banned = $this->user('eskiyasakli');
        $banned->forceFill(['banned_at' => now()->subDays(5), 'ban_reason' => 'hile'])->save();
        DB::table('shield_events')->insert([
            'user_id' => $banned->id, 'ip' => '46.1.2.3', 'type' => 'rate_burst',
            'severity' => 1, 'created_at' => now()->subDays(10),
        ]);
        $fresh = $this->user('yenihesap');
        $this->presence($fresh, '46.1.2.3');

        $rows = (new BanKacaklari)->suspects();

        $this->assertCount(1, $rows, 'yasaklının IP izi shield_events\'ten kurtarılmalı');
        $this->assertSame($banned->id, $rows[0]['links'][0]['bannedId']);
    }

    public function test_deleted_banned_accounts_are_ignored(): void
    {
        $del = $this->user('silinmis');
        $del->forceFill(['banned_at' => now()->subDay(), 'ban_reason' => 'account_deleted'])->save();
        $fresh = $this->user('yeni');
        $this->presence($del, '1.2.3.4');
        $this->presence($fresh, '1.2.3.4');

        $this->assertCount(0, (new BanKacaklari)->suspects(), 'account_deleted yasaklı bağ üretmemeli');
    }
}
