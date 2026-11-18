<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\ClubMember;
use App\Models\Notification;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Support\UserEraser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * UserEraser — kullanıcı silme TEK sözleşmesi (deleteAccount + PurgeTestAccounts + admin
 * çoklu-silme ortak). Kritik: kulüp SAHİBİ silinince masum üyeler kulüpsüz KALMAMALI.
 */
class UserEraserTest extends TestCase
{
    use RefreshDatabase;

    private function member(Club $club, User $u, string $role, string $createdAt): void
    {
        $m = ClubMember::create(['club_id' => $club->id, 'user_id' => $u->id, 'role' => $role]);
        // orderBy('created_at') deterministik olsun diye zaman DAMGASINI elle ayarla.
        $m->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();
    }

    public function test_owner_deletion_transfers_club_to_oldest_other_member(): void
    {
        $owner = User::factory()->create();
        $older = User::factory()->create();
        $newer = User::factory()->create();

        $club = Club::create(['name' => 'Kulüp', 'owner_id' => $owner->id, 'members_count' => 3]);
        $this->member($club, $owner, 'owner', '2026-01-01 00:00:00');
        $this->member($club, $older, 'member', '2026-01-02 00:00:00'); // en eski DİĞER üye
        $this->member($club, $newer, 'member', '2026-01-03 00:00:00');

        UserEraser::erase($owner);

        // Kulüp DURUYOR, sahiplik en eski diğer üyeye (older) geçti.
        $this->assertDatabaseHas('clubs', ['id' => $club->id, 'owner_id' => $older->id]);
        $this->assertDatabaseHas('club_members', ['user_id' => $older->id, 'role' => 'owner']);
        // Silinen sahip + üyeliği gitti (cascade); masum üyeler DURUYOR.
        $this->assertDatabaseMissing('users', ['id' => $owner->id]);
        $this->assertDatabaseMissing('club_members', ['user_id' => $owner->id]);
        $this->assertDatabaseHas('users', ['id' => $newer->id]);
        // members_count 3 -> 2 (sahip çıktı, iki üye kaldı).
        $this->assertSame(2, (int) $club->fresh()->members_count);
    }

    public function test_owner_deletion_closes_club_when_no_other_members(): void
    {
        $owner = User::factory()->create();
        $club = Club::create(['name' => 'Tek', 'owner_id' => $owner->id, 'members_count' => 1]);
        $this->member($club, $owner, 'owner', '2026-01-01 00:00:00');

        UserEraser::erase($owner);

        $this->assertDatabaseMissing('clubs', ['id' => $club->id]); // başka üye yok -> kapandı
        $this->assertDatabaseMissing('users', ['id' => $owner->id]);
    }

    public function test_founder_deletion_transfers_team_and_keeps_roster_clean(): void
    {
        $founder = User::factory()->create(['rating' => 1500]);
        $older = User::factory()->create(['rating' => 1700]); // en eski DİĞER üye
        $newer = User::factory()->create(['rating' => 1300]);

        $team = Team::create([
            'name' => 'Akıncılar', 'tag' => 'AKN', 'name_key' => 'akincilar', 'tag_key' => 'akn',
            'founder_id' => $founder->id, 'status' => 'active', 'member_count' => 3, 'rating_avg' => 1500,
        ]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $founder->id, 'role' => 'founder', 'joined_at' => '2026-01-01 00:00:00']);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $older->id, 'role' => 'member', 'joined_at' => '2026-01-02 00:00:00']);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $newer->id, 'role' => 'member', 'joined_at' => '2026-01-03 00:00:00']);

        UserEraser::erase($founder);

        // Takım DURUYOR, kuruculuk en eski diğer üyeye geçti, silinen artık roster'da YOK.
        $this->assertDatabaseHas('teams', ['id' => $team->id, 'founder_id' => $older->id]);
        $this->assertDatabaseHas('team_members', ['user_id' => $older->id, 'role' => 'founder']);
        $this->assertDatabaseMissing('team_members', ['user_id' => $founder->id]);
        // Sayaçlar canlı iki üyeden tazelendi: count=2, avg=(1700+1300)/2=1500.
        $team->refresh();
        $this->assertSame(2, (int) $team->member_count);
        $this->assertSame(1500.0, round((float) $team->rating_avg, 1));
    }

    public function test_founder_deletion_closes_team_when_alone(): void
    {
        $founder = User::factory()->create();
        $team = Team::create([
            'name' => 'Tek', 'tag' => 'TEK', 'name_key' => 'tek', 'tag_key' => 'tek',
            'founder_id' => $founder->id, 'status' => 'active', 'member_count' => 1, 'rating_avg' => 1500,
        ]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $founder->id, 'role' => 'founder', 'joined_at' => '2026-01-01 00:00:00']);

        UserEraser::erase($founder);

        $this->assertDatabaseMissing('teams', ['id' => $team->id]); // başka üye yok -> kapandı
        $this->assertDatabaseMissing('team_members', ['user_id' => $founder->id]);
    }

    public function test_erase_removes_notifications_and_tokens(): void
    {
        $u = User::factory()->create();
        Notification::create(['user_id' => $u->id, 'title' => 'Selam']);
        $u->createToken('web');

        UserEraser::erase($u);

        $this->assertDatabaseMissing('users', ['id' => $u->id]);
        $this->assertDatabaseMissing('notifications', ['user_id' => $u->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $u->id, 'tokenable_type' => User::class]);
    }
}
