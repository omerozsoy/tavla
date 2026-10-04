<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

// A-06: /panel/login'de hız sınırı / hesap kilidi yoktu ve "Bu hesap yönetici değil" mesajı yönetici
// olmayan bir oyuncunun şifresinin DOĞRU olduğunu ele veriyordu.
class PanelLoginSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class);
    }

    public function test_non_admin_correct_password_gets_same_message_as_wrong_password(): void
    {
        $u = User::factory()->create(['email' => 'p@x.test', 'password' => bcrypt('dogru-sifre')]);
        $wrong = $this->post('/panel/login', ['email' => 'p@x.test', 'password' => 'yanlis'])->assertRedirect();
        $right = $this->post('/panel/login', ['email' => 'p@x.test', 'password' => 'dogru-sifre'])->assertRedirect();
        $this->assertSame(session('errors')->first('email'), 'E-posta veya şifre hatalı.');
        $this->assertGuest();
        unset($wrong, $right, $u);
    }

    public function test_account_lockout_after_five_failures(): void
    {
        User::factory()->create(['email' => 'adm@x.test', 'password' => bcrypt('gizli'), 'is_admin' => true]);
        Cache::put('login-fails:'.sha1('adm@x.test'), 5, now()->addMinutes(15));
        $this->post('/panel/login', ['email' => 'adm@x.test', 'password' => 'gizli'])->assertRedirect();
        $this->assertGuest();
        $this->assertStringContainsString('Çok fazla', session('errors')->first('email'));
    }

    public function test_route_is_rate_limited(): void
    {
        $codes = [];
        for ($i = 0; $i < 7; $i++) {
            $codes[] = $this->post('/panel/login', ['email' => "x{$i}@x.test", 'password' => 'a'])->getStatusCode();
        }
        $this->assertContains(429, $codes, 'IP hız sınırı devrede olmalı: '.implode(',', $codes));
    }

    public function test_admin_can_still_log_in(): void
    {
        User::factory()->create(['email' => 'adm2@x.test', 'password' => bcrypt('gizli'), 'is_admin' => true]);
        $this->post('/panel/login', ['email' => 'adm2@x.test', 'password' => 'gizli'])->assertRedirect('/panel/users');
        $this->assertAuthenticated();
    }
}
