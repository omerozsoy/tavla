<?php

namespace Tests\Feature;

use App\Filament\Resources\MutedUserResource\Pages\ListMutedUsers;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

// "Yasaklılar" listesi bir satır varken render edilmeli. color() closure param adı
// $state olmazsa Filament state'i enjekte edemez -> null -> TypeError (satır çizilince 500).
class MutedUserResourceTest extends TestCase
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

    public function test_list_renders_with_a_muted_user_present(): void
    {
        $admin = $this->user('admin', true);
        $muted = $this->user('offender');
        $muted->forceFill(['chat_offenses' => 2, 'chat_muted_until' => now()->addDay()])->save();

        Livewire::actingAs($admin)->test(ListMutedUsers::class)
            ->assertOk()
            ->assertCanSeeTableRecords([$muted]);
    }
}
