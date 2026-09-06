<?php

namespace Tests\Feature;

use App\Support\Alert;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

// Alert::transition spam-önleyici mantığı: yalnız DÜŞÜŞ anında uyar, düşük kaldıkça bastır,
// düzelince "recovered". Kanallar (email/WhatsApp) test'te ayarsız -> yalnız log (dış çağrı yok).
class AlertTransitionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        // Kanalları kapat -> Alert::send dış çağrı yapmaz (yalnız log).
        config(['services.admin_emails' => [], 'services.alert.whatsapp_phone' => '', 'services.alert.whatsapp_apikey' => '']);
    }

    public function test_alerts_once_then_suppresses_then_recovers(): void
    {
        // İlk düşüş -> uyar.
        $this->assertSame('alerted-down', Alert::transition('svcX', true, 'DÜŞTÜ', 'DÜZELDİ'));
        // Hemen tekrar düşük -> bastır (spam yok).
        $this->assertSame('suppressed-down', Alert::transition('svcX', true, 'DÜŞTÜ', 'DÜZELDİ'));
        $this->assertSame('suppressed-down', Alert::transition('svcX', true, 'DÜŞTÜ', 'DÜZELDİ'));
        // Düzeldi -> recovered (bir kez).
        $this->assertSame('recovered', Alert::transition('svcX', false, 'DÜŞTÜ', 'DÜZELDİ'));
        // Ayakta kalır -> ok (uyarı yok).
        $this->assertSame('ok', Alert::transition('svcX', false, 'DÜŞTÜ', 'DÜZELDİ'));
    }

    public function test_realert_after_window(): void
    {
        $this->assertSame('alerted-down', Alert::transition('svcY', true, 'DÜŞTÜ', '', 900));
        $this->assertSame('suppressed-down', Alert::transition('svcY', true, 'DÜŞTÜ', '', 900));
        // Son-uyarı zamanını geçmişe al -> pencere doldu -> yeniden uyar.
        Cache::put('alert:svcY:last', time() - 1000, now()->addDay());
        $this->assertSame('alerted-down', Alert::transition('svcY', true, 'DÜŞTÜ', '', 900));
    }

    public function test_independent_keys_do_not_interfere(): void
    {
        $this->assertSame('alerted-down', Alert::transition('a', true, 'x'));
        $this->assertSame('alerted-down', Alert::transition('b', true, 'x')); // ayrı servis -> ayrı durum
        $this->assertSame('suppressed-down', Alert::transition('a', true, 'x'));
    }
}
