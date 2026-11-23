<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserAchievement;
use App\Models\UserStat;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * tavla:reign-tick — günlük liderlik "reign" sayacı + Taht(7)/Hanedan(30) rozetleri.
 * Sadece o anki #1'in reign_days'i artar; TOPLAM gün (sıfırlanmaz); aynı gün çift-sayım engellenir.
 */
class ReignTickTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $nick, array $attrs = []): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com', 'password' => bcrypt('secret123'),
        ]);
        $u->forceFill(array_merge(['is_system' => false], $attrs))->save();

        return $u;
    }

    public function test_tick_increments_only_top1_and_unlocks_throne_at_7(): void
    {
        $leader = $this->makeUser('leader', ['rating' => 2000, 'wins' => 50]);
        $second = $this->makeUser('second', ['rating' => 1800, 'wins' => 40]);

        // Lider 6 gündür zirvede; bu tick 7. günü tamamlar -> Taht (reign_7) açılmalı.
        UserStat::forUser($leader->id)->update(['reign_days' => 6]);

        $this->artisan('tavla:reign-tick', ['--force' => true])->assertExitCode(0);

        $this->assertSame(7, (int) UserStat::forUser($leader->id)->reign_days);
        $this->assertTrue(
            UserAchievement::where('user_id', $leader->id)->where('achievement_slug', 'reign_7')->exists(),
            'Lider 7. günde Taht almalı'
        );
        // #1 olmayanın reign_days'i artmaz, rozet almaz.
        $this->assertSame(0, (int) UserStat::forUser($second->id)->reign_days);
        $this->assertFalse(
            UserAchievement::where('user_id', $second->id)->where('achievement_slug', 'reign_7')->exists()
        );
    }

    public function test_same_day_second_run_is_idempotent(): void
    {
        $leader = $this->makeUser('leader', ['rating' => 2000]);

        $this->artisan('tavla:reign-tick')->assertExitCode(0);  // 0 -> 1
        $this->artisan('tavla:reign-tick')->assertExitCode(0);  // aynı gün tekrar -> atlanır

        $this->assertSame(1, (int) UserStat::forUser($leader->id)->reign_days, 'Aynı gün ikinci çalıştırma saymamalı');
    }

    public function test_dynasty_unlocks_at_30(): void
    {
        $leader = $this->makeUser('leader', ['rating' => 2000]);
        UserStat::forUser($leader->id)->update(['reign_days' => 29]);

        $this->artisan('tavla:reign-tick', ['--force' => true])->assertExitCode(0);

        $this->assertTrue(
            UserAchievement::where('user_id', $leader->id)->where('achievement_slug', 'reign_30')->exists(),
            'Lider 30. günde Hanedan almalı'
        );
    }
}
