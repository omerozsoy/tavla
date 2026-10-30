<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserStat;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * /me ve publicProfile turnuva sampiyonlugu sayisini (user_stats.tournaments_won)
 * JSON'a verir. Kritik nokta: tournaments_won User tablosunda KOLON DEGIL -> dinamik
 * atanan attribute'un serilestigini dogrular.
 */
class MeTournamentsWonTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'),
        ]);
    }

    public function test_me_returns_tournaments_won(): void
    {
        $u = $this->makeUser('champ');
        $stat = UserStat::forUser($u->id);
        $stat->tournaments_won = 3;
        $stat->save();

        Sanctum::actingAs($u);
        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.tournaments_won', 3);
    }

    public function test_me_defaults_to_zero(): void
    {
        $u = $this->makeUser('rookie');
        Sanctum::actingAs($u);
        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.tournaments_won', 0);
    }

    public function test_public_profile_returns_tournaments_won(): void
    {
        $u = $this->makeUser('viewed');
        UserStat::forUser($u->id)->fill(['tournaments_won' => 5])->save();

        $this->getJson('/api/users/'.$u->id.'/profile')
            ->assertOk()
            ->assertJsonPath('tournaments_won', 5);
    }
}
