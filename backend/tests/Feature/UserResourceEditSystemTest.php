<?php

namespace Tests\Feature;

use App\Filament\Resources\UserResource\Pages\EditUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

// #1 = sistem/yonetim hesabi (is_system=1). Admin panelde bu hesabi DUZENLEMEK 500 veriyordu.
// Uretim satirini birebir taklit edip hem form yuklemeyi hem KAYDETMEYI reprodce et.
class UserResourceEditSystemTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::create([
            'nickname' => 'boss', 'email' => 'boss@e.com', 'password' => bcrypt('secret123'),
            'first_name' => 'Boss', 'last_name' => 'T', 'country' => 'TR',
        ]);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    private function systemUser(): User
    {
        // uretimdeki id=1 satirinin birebir kopyasi
        $u = User::create([
            'nickname' => 'Tavla TV Yönetim', 'email' => 'yonetim@sistem.tavlatv',
            'password' => bcrypt(bin2hex(random_bytes(16))),
            'first_name' => 'Tavla TV Yönetim', 'last_name' => '', 'country' => 'TR',
        ]);
        $u->forceFill([
            'is_system' => true, 'plan' => 'free', 'rating' => 1500,
            'wins' => 0, 'losses' => 0, 'games_played' => 0, 'coins' => 0,
            'province' => '', 'avatar' => '/uploads/system/01M35V3K7A6FQDSPAWMR3NY87N.jpg',
            'presence_status' => 'available', 'total_wxp' => 0,
        ]);
        $u->save();

        return $u;
    }

    public function test_admin_can_open_system_account_edit_form(): void
    {
        $admin = $this->admin();
        $sys = $this->systemUser();

        $this->actingAs($admin)
            ->get('/admin/users/'.$sys->id.'/edit')
            ->assertOk();
    }

    public function test_admin_can_save_system_account_unchanged(): void
    {
        $admin = $this->admin();
        $sys = $this->systemUser();

        // Hicbir sey degistirmeden KAYDET: 16-karakter nickname + bos last_name aynen gecmeli
        // (nickname 32'ye cikti, bos ad/soyad '' olarak yazilir -> NOT NULL 500 yok).
        Livewire::actingAs($admin)
            ->test(EditUser::class, ['record' => $sys->id])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('users', [
            'id' => $sys->id, 'nickname' => 'Tavla TV Yönetim', 'last_name' => '',
        ]);
    }
}
