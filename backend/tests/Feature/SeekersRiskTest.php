<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Oyun Arayanlar POT: 'risk' = arayanın riske ettiği GERÇEK tutar. %-bahiste arayanın
// kullanılabilir bakiyesinin (coins - reserved) bet_pct'si (floor); sabit bahiste stake.
// İstemci bunu kendi riskiyle min'ler -> gerçek pot (settle snapshot ile aynı formül).
class SeekersRiskTest extends TestCase
{
    use RefreshDatabase;

    private function seeker(int $coins, int $reserved = 0): User
    {
        return User::factory()->create(['coins' => $coins, 'coins_reserved' => $reserved]);
    }

    private function waiting(User $u, int $betPct, int $stake = 0): void
    {
        Room::create([
            'code' => 'W'.$u->id, 'p1_token' => 't'.$u->id, 'p1_name' => $u->nickname,
            'p1_user_id' => $u->id, 'status' => 'mm_waiting', 'version' => 0,
            'target' => 1, 'targets' => [1], 'stake' => $stake, 'stakes' => [$stake],
            'bet_pct' => $betPct, 'time_control' => 'normal',
        ]);
    }

    public function test_pct_risk_is_floor_of_available_coins(): void
    {
        $this->waiting($this->seeker(2000), 50);

        $row = collect($this->getJson('/api/seekers')->json('seekers'))
            ->firstWhere('kind', 'seeking');

        $this->assertSame(1000, $row['risk']); // floor(2000 * 50 / 100)
    }

    public function test_pct_risk_uses_available_not_total(): void
    {
        $u = $this->seeker(2000, 400); // available = 1600
        $this->waiting($u, 50);

        $row = collect($this->getJson('/api/seekers')->json('seekers'))
            ->firstWhere('kind', 'seeking');

        $this->assertSame(800, $row['risk']); // floor(1600 * 50 / 100)
    }

    public function test_fixed_stake_risk_equals_stake(): void
    {
        $u = $this->seeker(5000);
        $this->waiting($u, 0, 250);

        $row = collect($this->getJson('/api/seekers')->json('seekers'))
            ->firstWhere('kind', 'seeking');

        $this->assertSame(250, $row['risk']);
    }
}
