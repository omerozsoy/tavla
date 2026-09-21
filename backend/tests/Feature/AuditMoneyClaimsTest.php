<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class AuditMoneyClaimsTest extends TestCase
{
    use RefreshDatabase;

    public function test_read_only_audit_reports_clean_active_claims(): void
    {
        $user = User::factory()->create();
        $room = Room::create([
            'code' => 'AUDIT1', 'p1_token' => 'a', 'p1_user_id' => $user->id,
            'p1_name' => 'P1', 'status' => 'playing', 'mode' => 'ranked',
            'stake' => 10, 'version' => 0,
        ]);
        Room::claimActiveMoneySlot($user->id, $room->id);

        $this->artisan('security:money-claims')
            ->expectsOutput('active_money_rooms=1')
            ->expectsOutput('claim_rows=1')
            ->expectsOutput('duplicate_active_users=0')
            ->expectsOutput('missing_claims=0')
            ->expectsOutput('stale_claims=0')
            ->assertExitCode(0);
    }
}
