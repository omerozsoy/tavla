<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Admin panel kullanıcı DETAY (sekmeli) görünümü hatasız render olmalı + sekme yardımcıları doğru.
class UserResourceViewTest extends TestCase
{
    use RefreshDatabase;

    private function make(string $n, bool $admin = false): User
    {
        $u = User::create([
            'first_name' => $n, 'last_name' => 'T', 'country' => 'TR',
            'nickname' => $n, 'email' => $n.'@e.com', 'password' => bcrypt('secret123'),
        ]);
        $u->rating = 1600;
        $u->coins = 500;
        $u->wins = 4;
        $u->losses = 2;
        $u->games_played = 6;
        if ($admin) {
            $u->is_admin = true;
        }
        $u->save();

        return $u;
    }

    public function test_owned_cosmetics_helpers_split_by_prefix(): void
    {
        $u = $this->make('cosmo');
        $u->unlocks = ['theme.iznik', 'theme.nautical', 'frame.pulse', 'checker.gold', 'garbage'];
        $u->save();

        $this->assertSame(['iznik', 'nautical'], \App\Filament\Resources\UserResource::ownedBoards($u));
        $this->assertSame(['pulse'], \App\Filament\Resources\UserResource::ownedFrames($u));
        $this->assertSame(['gold'], \App\Filament\Resources\UserResource::ownedCheckers($u));
    }

    public function test_admin_can_render_user_detail_view(): void
    {
        $admin = $this->make('boss', admin: true);
        $target = $this->make('target');
        $target->unlocks = ['theme.iznik', 'frame.pulse'];
        $target->avatar_frame = 'frame.pulse';
        $target->save();

        // Bir maç kaydı -> Maçlar sekmesi + blade render edilir
        DB::table('match_results')->insert([
            'user_id' => $target->id, 'won' => true, 'opponent_rating' => 1500,
            'opponent_name' => 'Rakip', 'rating_before' => 1585, 'rating_after' => 1600,
            'delta' => 15, 'room_code' => 'ABC12', 'score_self' => 1, 'score_opp' => 0,
            'pr' => 4.2, 'match_type' => 'normal', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($admin) // Filament web guard
            ->get('/admin/users/'.$target->id)
            ->assertOk()
            ->assertSee('Boardlar')
            ->assertSee('Maçlar')
            ->assertSee('Üyelik');
    }

    public function test_non_admin_cannot_access_panel_view(): void
    {
        $target = $this->make('t2');
        $plain = $this->make('plain'); // is_admin false

        $this->actingAs($plain)
            ->get('/admin/users/'.$target->id)
            ->assertForbidden();
    }
}
