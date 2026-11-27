<?php

namespace Tests\Feature;

use App\Filament\Pages\RatingSettings;
use App\Models\Setting;
use App\Models\User;
use App\Support\RankDivisions;
use App\Support\RankProgress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/** Rating Ayar (Filament): admin minEP + PR penceresi + aktif/pasif + düşüş toleransını kaydedebilir. */
class RankAdminSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::create([
            'nickname' => 'radm', 'email' => 'radm@e.com', 'password' => bcrypt('secret123'),
            'first_name' => 'A', 'last_name' => 'D', 'country' => 'TR',
        ]);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    public function test_admin_saves_ep_and_scalar_settings(): void
    {
        $this->actingAs($this->admin());

        Livewire::test(RatingSettings::class)
            ->set('data.div_g3__ep', 420) // g3 (varsayılan 400) -> 420, m1=400 ≤ 420 ≤ g2=450 (azalmayan)
            ->set('data.rank_pr_window_ep', 300)
            ->set('data.rank_system_active', true)
            ->set('data.rank_demote_grace_days', 7)
            ->call('save')
            ->assertHasNoErrors();

        $this->assertSame(420, RankDivisions::epThresholds()['div.g3']);
        $this->assertSame(300, RankProgress::windowEp());
        $this->assertSame('1', Setting::get('rank_system_active'));
        $this->assertSame(7, Setting::int('rank_demote_grace_days'));
    }

    public function test_decreasing_ep_is_rejected(): void
    {
        $this->actingAs($this->admin());

        // g3'ü 10 yap (m1=400'den düşük) -> azalmayan kuralı reddeder, kaydetmez.
        Livewire::test(RatingSettings::class)
            ->set('data.div_g3__ep', 10)
            ->call('save');

        $this->assertSame(400, RankDivisions::epThresholds()['div.g3']); // varsayılan korundu
    }
}
