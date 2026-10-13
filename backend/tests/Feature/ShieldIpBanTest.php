<?php

namespace Tests\Feature;

use App\Filament\Pages\GuvenlikKalkani;
use App\Models\User;
use App\Support\Shield;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\TestCase;

class ShieldIpBanTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $a = User::factory()->create();
        $a->forceFill(['is_admin' => true])->save();

        return $a;
    }

    public function test_banned_ip_is_blocked_at_the_gate(): void
    {
        Shield::flushIpBans();
        DB::table('shield_ip_bans')->insert(['ip' => '203.0.113.9', 'created_at' => now()]);
        Shield::flushIpBans();

        $this->assertTrue(Shield::ipBanned('203.0.113.9'));
        $this->assertFalse(Shield::ipBanned('203.0.113.10'));

        // SiteGate yasaklı IP'yi controller'a girmeden 403 ile keser.
        $gate = new \App\Http\Middleware\SiteGate;
        $banned = \Illuminate\Http\Request::create('/api/x', 'GET', server: ['REMOTE_ADDR' => '203.0.113.9']);
        $res = $gate->handle($banned, fn () => response('ok'));
        $this->assertSame(403, $res->getStatusCode());

        $clean = \Illuminate\Http\Request::create('/api/x', 'GET', server: ['REMOTE_ADDR' => '203.0.113.10']);
        $this->assertSame('ok', $gate->handle($clean, fn () => response('ok'))->getContent());
    }

    public function test_admin_can_ban_and_unban_ip_from_panel(): void
    {
        $admin = $this->admin();

        Livewire::actingAs($admin)->test(GuvenlikKalkani::class)
            ->call('banIp', '198.51.100.7', 'Brute-force giriş');
        $this->assertTrue(Shield::ipBanned('198.51.100.7'));

        $id = DB::table('shield_ip_bans')->where('ip', '198.51.100.7')->value('id');
        Livewire::actingAs($admin)->test(GuvenlikKalkani::class)->call('unbanIp', $id);
        $this->assertFalse(Shield::ipBanned('198.51.100.7'));
    }

    public function test_invalid_ip_is_rejected(): void
    {
        $admin = $this->admin();
        Livewire::actingAs($admin)->test(GuvenlikKalkani::class)->call('banIp', 'not-an-ip');
        $this->assertSame(0, DB::table('shield_ip_bans')->count());
    }

    public function test_repeated_login_failures_raise_brute_force_event(): void
    {
        // 8 başarısız giriş (yanlış şifre = 422/401) → tek 'brute_force' tehlike olayı.
        for ($i = 0; $i < 9; $i++) {
            Shield::record(
                \Illuminate\Http\Request::create('/api/login', 'POST', server: ['REMOTE_ADDR' => '192.0.2.50']),
                401
            );
        }
        $this->assertTrue(
            DB::table('shield_events')->where('type', 'brute_force')->exists(),
            'ard arda başarısız giriş brute-force olayı üretmeli'
        );
    }
}
