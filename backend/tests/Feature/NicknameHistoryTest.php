<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NicknameHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_nickname_change_is_recorded(): void
    {
        $user = User::factory()->create(['nickname' => 'eski']);

        $user->update(['nickname' => 'yeni']);
        $user->update(['nickname' => 'enyeni']);

        $this->assertSame(['eski', 'yeni'], collect($user->fresh()->nickname_history)->pluck('nickname')->all());
    }

    public function test_non_nickname_update_adds_nothing(): void
    {
        $user = User::factory()->create(['nickname' => 'sabit']);
        $user->update(['first_name' => 'Ali']);

        $this->assertNull($user->fresh()->nickname_history);
    }

    public function test_anonymization_does_not_record_real_nickname(): void
    {
        // UserEraser deseni: nickname -> 'silinmisN' + ban_reason='account_deleted' aynı save'de.
        $user = User::factory()->create(['nickname' => 'gercekisim']);
        $user->forceFill(['nickname' => 'silinmis'.$user->id, 'ban_reason' => 'account_deleted'])->save();

        $this->assertNull($user->fresh()->nickname_history);
    }
}
