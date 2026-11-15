<?php

namespace Tests\Feature;

use App\Filament\Pages\GuvenlikKalkani;
use App\Http\Middleware\SiteGate;
use App\Models\User;
use App\Support\Shield;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
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
        $gate = new SiteGate;
        $banned = Request::create('/api/x', 'GET', server: ['REMOTE_ADDR' => '203.0.113.9']);
        $res = $gate->handle($banned, fn () => response('ok'));
        $this->assertSame(403, $res->getStatusCode());

        $clean = Request::create('/api/x', 'GET', server: ['REMOTE_ADDR' => '203.0.113.10']);
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

    // Güvenlik Kalkanı'ndan hesap engelleme ARTIK ortak audit'li yoldan (AccountClosure) gider:
    // ham banned_at save() DEĞİL -> account_ban_events forensik izi + actor + token iptali. Eskiden
    // bu sayfadan ban iz bırakmıyordu. Biri block()'u tekrar ham save()'e çevirirse bu test düşer.
    public function test_block_from_panel_bans_with_audit_trail(): void
    {
        $admin = $this->admin();
        $target = User::factory()->create();

        Livewire::actingAs($admin)->test(GuvenlikKalkani::class)->call('block', $target->id);

        $target->refresh();
        $this->assertNotNull($target->banned_at, 'hesap engellenmeli');
        $this->assertSame($admin->id, (int) $target->banned_by);
        $this->assertTrue(
            DB::table('account_ban_events')->where('user_id', $target->id)->where('action', 'closed')->exists(),
            'ban forensik iz (account_ban_events) bırakmalı',
        );

        // Çözüm de aynı yoldan: engel kalkar + reopened olayı yazılır.
        Livewire::actingAs($admin)->test(GuvenlikKalkani::class)->call('unblock', $target->id);
        $target->refresh();
        $this->assertNull($target->banned_at, 'engel kalkmalı');
        $this->assertTrue(
            DB::table('account_ban_events')->where('user_id', $target->id)->where('action', 'reopened')->exists(),
            'çözüm de iz bırakmalı',
        );
    }

    public function test_repeated_login_failures_raise_brute_force_event(): void
    {
        // 8 başarısız giriş (yanlış şifre = 422/401) → tek 'brute_force' tehlike olayı.
        for ($i = 0; $i < 9; $i++) {
            Shield::record(
                Request::create('/api/login', 'POST', server: ['REMOTE_ADDR' => '192.0.2.50']),
                401
            );
        }
        $this->assertTrue(
            DB::table('shield_events')->where('type', 'brute_force')->exists(),
            'ard arda başarısız giriş brute-force olayı üretmeli'
        );
    }
}
