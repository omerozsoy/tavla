<?php

namespace Tests\Feature;

use App\Filament\Resources\UserResource\Pages\CreateUser;
use App\Filament\Resources\UserResource\Pages\EditUser;
use App\Models\User;
use App\Support\AccountClosure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Livewire\Livewire;
use Tests\TestCase;

// A-18: Filament kullanıcı ekranları kök (config) yöneticiyi korumuyordu: sıradan yönetici kök
// hesabın şifresini/e-postasını değiştirip ele geçirebiliyor, yetkisini alabiliyor, kapatabiliyordu;
// kendi e-postasını kök adrese çevirip silinemez yönetici olabiliyordu; yeni hesaba defter dışı coin.
class AdminGuardFilamentTest extends TestCase
{
    use RefreshDatabase;

    private User $root;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.admin_emails' => ['root@tavla.test', 'bos@tavla.test']]);
        $this->root = User::factory()->create(['email' => 'root@tavla.test', 'password' => Hash::make('kok-sifre')]);
        $this->root->forceFill(['is_admin' => true])->save();
        $this->admin = User::factory()->create(['email' => 'adm@tavla.test']);
        $this->admin->forceFill(['is_admin' => true])->save();
    }

    public function test_regular_admin_cannot_change_root_password(): void
    {
        Livewire::actingAs($this->admin)->test(EditUser::class, ['record' => $this->root->id])
            ->fillForm(['password' => 'ele-gecirdim'])->call('save')->assertHasFormErrors(['password']);
        $this->assertTrue(Hash::check('kok-sifre', $this->root->fresh()->password));
    }

    public function test_regular_admin_cannot_demote_root(): void
    {
        Livewire::actingAs($this->admin)->test(EditUser::class, ['record' => $this->root->id])
            ->fillForm(['is_admin' => false])->call('save')->assertHasFormErrors(['is_admin']);
        $this->assertTrue((bool) $this->root->fresh()->is_admin);
    }

    public function test_regular_admin_cannot_take_root_email(): void
    {
        Livewire::actingAs($this->admin)->test(EditUser::class, ['record' => $this->admin->id])
            ->fillForm(['email' => 'bos@tavla.test'])->call('save')->assertHasFormErrors(['email']);
        $this->assertSame('adm@tavla.test', $this->admin->fresh()->email);
    }

    public function test_regular_admin_cannot_close_root_account(): void
    {
        $this->expectException(\RuntimeException::class);
        AccountClosure::close($this->root, $this->admin->id, 'x');
    }

    public function test_root_can_still_edit_and_close_others(): void
    {
        $p = User::factory()->create();
        Livewire::actingAs($this->root)->test(EditUser::class, ['record' => $this->admin->id])
            ->fillForm(['is_admin' => false])->call('save')->assertHasNoFormErrors();
        $this->assertFalse((bool) $this->admin->fresh()->is_admin);
        AccountClosure::close($p, $this->root->id, 'kural');
        $this->assertTrue($p->fresh()->isBanned());
    }

    public function test_create_user_coins_go_through_ledger(): void
    {
        Livewire::actingAs($this->admin)->test(CreateUser::class)
            ->fillForm(['nickname' => 'yeniuye', 'email' => 'yeni@tavla.test', 'password' => 'secret123',
                'first_name' => 'Y', 'last_name' => 'U', 'coins' => 500])
            ->call('create')->assertHasNoFormErrors();
        $u = User::where('email', 'yeni@tavla.test')->first();
        $this->assertSame(500, (int) $u->coins);
        $this->assertTrue(DB::table('wallet_transactions')->where('user_id', $u->id)->exists(), 'coin deftere yazılmalı');
    }
}
