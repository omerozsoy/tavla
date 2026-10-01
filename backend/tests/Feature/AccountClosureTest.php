<?php

namespace Tests\Feature;

use App\Filament\Resources\UserResource\Pages\ListUsers;
use App\Models\User;
use App\Support\AccountClosure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Livewire\Livewire;
use Tests\TestCase;

// Hesap kapatma (siteden yasaklama) — spec test listesi.
class AccountClosureTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $n, bool $admin = false): User
    {
        $u = User::create([
            'nickname' => $n, 'email' => $n.'@e.com', 'password' => bcrypt('secret123'),
            'first_name' => $n, 'last_name' => 'T', 'country' => 'TR',
        ]);
        if ($admin) {
            $u->forceFill(['is_admin' => true])->save();
        }

        return $u;
    }

    public function test_closed_account_cannot_login_even_with_correct_password(): void
    {
        $u = $this->user('ali');
        AccountClosure::close($u, 1, 'kötüye kullanım');

        $this->postJson('/api/login', ['login' => 'ali@e.com', 'password' => 'secret123'])
            ->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'Hesabınız kapatılmıştır.');
    }

    public function test_wrong_password_keeps_generic_error_and_hides_status(): void
    {
        $u = $this->user('veli');
        AccountClosure::close($u, 1, 'x');

        // Kapalı hesaba YANLIŞ şifre -> durum sızmaz, generic hata.
        $this->postJson('/api/login', ['login' => 'veli@e.com', 'password' => 'yanlis'])
            ->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'E-posta/takma isim veya şifre hatalı.');
    }

    public function test_existing_token_is_revoked_on_close(): void
    {
        $u = $this->user('can');
        $token = $u->createToken('web')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/me')->assertOk();

        AccountClosure::close($u, 1, 'temizlik');
        $this->assertSame(0, DB::table('personal_access_tokens')->where('tokenable_id', $u->id)->count());

        // Gerçekte her istek taze; testte guard aynı app'te memoize olur -> temizle.
        $this->app['auth']->forgetGuards();
        // Token silindi -> eski oturum 401 (unauthenticated).
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/me')->assertStatus(401);
    }

    public function test_password_reset_does_not_lift_ban(): void
    {
        $u = $this->user('deniz');
        AccountClosure::close($u, 1, 'x');

        $token = Password::broker()->createToken($u);
        $this->postJson('/api/reset-password', [
            'token' => $token, 'email' => 'deniz@e.com', 'password' => 'Yenisifre1',
        ]);

        $this->assertTrue($u->fresh()->isBanned(), 'reset ban kaldırmamalı');
        // Reset kapalı hesapta şifreyi değiştirmez; doğru (orijinal) şifreyle bile giriş engelli.
        $this->postJson('/api/login', ['login' => 'deniz@e.com', 'password' => 'secret123'])
            ->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'Hesabınız kapatılmıştır.');
    }

    public function test_reopen_allows_new_login(): void
    {
        $u = $this->user('ece');
        AccountClosure::close($u, 1, 'x');
        AccountClosure::reopen($u, 1, 'itiraz kabul');

        $this->postJson('/api/login', ['login' => 'ece@e.com', 'password' => 'secret123'])
            ->assertOk()->assertJsonStructure(['user', 'token']);
    }

    public function test_ban_persists_across_restart(): void
    {
        $u = $this->user('mert');
        AccountClosure::close($u, 1, 'x');

        // "Yeniden başlatma" = taze DB okuması; banned_at kalıcı.
        $this->assertTrue(User::find($u->id)->isBanned());
    }

    public function test_close_and_reopen_are_audited_in_history(): void
    {
        $u = $this->user('zeynep');
        AccountClosure::close($u, 7, 'spam', 'iç not');
        AccountClosure::reopen($u, 7, 'düzeldi');

        $events = DB::table('account_ban_events')->where('user_id', $u->id)->orderBy('id')->get();
        $this->assertCount(2, $events);
        $this->assertSame('closed', $events[0]->action);
        $this->assertSame('iç not', $events[0]->note);
        $this->assertSame('reopened', $events[1]->action);
    }

    public function test_admin_note_never_serializes_to_client(): void
    {
        $u = $this->user('gizli');
        AccountClosure::close($u, 1, 'sebep', 'ADMIN-ONLY-NOT');

        $json = $u->fresh()->toArray();
        $this->assertArrayNotHasKey('ban_note', $json);
        $this->assertArrayNotHasKey('ban_reason', $json);
        $this->assertArrayNotHasKey('banned_by', $json);
    }

    public function test_closing_does_not_create_match_results_or_double_loss(): void
    {
        $u = $this->user('oyuncu');
        $before = DB::table('match_results')->count();
        AccountClosure::close($u, 1, 'x');
        // Kapatma tek başına HİÇBİR maç sonucu üretmez (çift sonuç/çift mağlubiyet yok);
        // aktif oyunlar mevcut hükmen backstop'una bırakılır.
        $this->assertSame($before, DB::table('match_results')->count());
    }

    public function test_non_admin_cannot_reach_panel_to_close(): void
    {
        $plain = $this->user('duz');
        // Panel admin-only (HTTP middleware): normal kullanıcı üye listesini -> dolayısıyla
        // kapatma/açma aksiyonunu açamaz.
        $this->actingAs($plain)->get('/admin/users')->assertForbidden();
    }

    public function test_admin_can_close_via_filament_table_action(): void
    {
        $admin = $this->user('boss', admin: true);
        $target = $this->user('hedef');

        Livewire::actingAs($admin)->test(ListUsers::class)
            ->callTableAction('closeAccount', $target, data: ['reason' => 'kural ihlali'])
            ->assertHasNoTableActionErrors();

        $this->assertTrue($target->fresh()->isBanned());
        $this->assertSame($admin->id, (int) $target->fresh()->banned_by);
    }

    public function test_reason_is_required_to_close(): void
    {
        $admin = $this->user('boss2', admin: true);
        $target = $this->user('hedef2');

        Livewire::actingAs($admin)->test(ListUsers::class)
            ->callTableAction('closeAccount', $target, data: ['reason' => ''])
            ->assertHasTableActionErrors(['reason' => ['required']]);

        $this->assertFalse($target->fresh()->isBanned());
    }
}
