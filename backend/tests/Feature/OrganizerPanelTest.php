<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Organizatör Paneli: atanmış organizatör SADECE kendi turnuvasına katılımcı ekler + sonuç girer;
 * başka kullanıcı 403 alır.
 */
class OrganizerPanelTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::factory()->create(['nickname' => $nick]);
    }

    public function test_only_manager_can_manage_and_add_participant(): void
    {
        $mgr = $this->user('organizator');
        $other = $this->user('baskasi');
        $t = Tournament::create([
            'name' => 'Salon Kupası', 'type' => 'swiss_outdoor', 'size' => 0, 'status' => 'open',
            'manager_user_id' => $mgr->id, 'players' => [],
        ]);

        // Yetkisiz kullanıcı -> 403
        $this->actingAs($other)->postJson("/api/organizer/tournaments/{$t->id}/participants", ['name' => 'Ali'])->assertStatus(403);
        // Organizatör listesinde başkasının turnuvası YOK
        $this->actingAs($other)->getJson('/api/organizer/tournaments')->assertOk()->assertJsonCount(0, 'tournaments');

        // Organizatör katılımcı ekler
        $this->actingAs($mgr)->postJson("/api/organizer/tournaments/{$t->id}/participants", ['name' => 'Ali'])->assertOk();
        $this->actingAs($mgr)->postJson("/api/organizer/tournaments/{$t->id}/participants", ['name' => 'Veli'])->assertOk();
        $t->refresh();
        $this->assertCount(2, $t->players);
        $this->assertTrue((bool) ($t->players[0]['offline'] ?? false));
        $this->assertGreaterThan(900000000, (int) $t->players[0]['id']); // sentetik pozitif id

        // Listede organizatörün turnuvası görünür
        $this->actingAs($mgr)->getJson('/api/organizer/tournaments')->assertOk()->assertJsonCount(1, 'tournaments');
    }

    public function test_enter_result_resolves_pending_swiss_match(): void
    {
        $mgr = $this->user('org2');
        $t = Tournament::create([
            'name' => 'Salon 2', 'type' => 'swiss_outdoor', 'size' => 0, 'status' => 'running',
            'manager_user_id' => $mgr->id,
            'players' => [
                ['id' => 900000001, 'name' => 'A', 'rating' => 1500, 'offline' => true],
                ['id' => 900000002, 'name' => 'B', 'rating' => 1500, 'offline' => true],
            ],
            'bracket' => [[
                ['key' => 'r0m0', 'round' => 1, 'p1' => ['id' => 900000001, 'name' => 'A'], 'p2' => ['id' => 900000002, 'name' => 'B'], 'winner' => null, 'target' => 1],
            ]],
            'swiss_state' => [
                'round' => 1, 'seed' => 'x', 'config' => ['match_length' => 1, 'lives' => 3],
                'participants' => [
                    ['id' => 900000001, 'name' => 'A', 'seed' => 1, 'rating' => 1500, 'status' => 'active', 'wins' => 0, 'losses' => 0, 'realWins' => 0, 'byes' => 0, 'byeRounds' => [], 'opponents' => [], 'pointsFor' => 0, 'pointsAgainst' => 0, 'lives' => 3, 'lastGroupDelta' => 0],
                    ['id' => 900000002, 'name' => 'B', 'seed' => 2, 'rating' => 1500, 'status' => 'active', 'wins' => 0, 'losses' => 0, 'realWins' => 0, 'byes' => 0, 'byeRounds' => [], 'opponents' => [], 'pointsFor' => 0, 'pointsAgainst' => 0, 'lives' => 3, 'lastGroupDelta' => 0],
                ],
            ],
        ]);

        // A (900000001) kazandı
        $this->actingAs($mgr)->postJson("/api/organizer/tournaments/{$t->id}/result", [
            'match' => 'r0m0', 'winner' => 900000001,
        ])->assertOk();

        $t->refresh();
        $this->assertSame(900000001, (int) $t->bracket[0][0]['winner']);
    }
}
