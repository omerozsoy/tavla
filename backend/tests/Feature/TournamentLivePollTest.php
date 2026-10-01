<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\Tournament;
use App\Models\User;
use App\Support\Backgammon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Turnuva sayfası canlı poll: show(?rev=) değişmediyse 204. Kayıtta katılımcılar, başladıktan
 * sonra YALNIZ maç sonuçları (winner) rev'i değiştirir; maç odası açılması (room/target) değiştirmez.
 */
class TournamentLivePollTest extends TestCase
{
    use RefreshDatabase;

    private function rev(Tournament $t): string
    {
        return $this->getJson("/api/tournaments/{$t->id}")->assertOk()->json('tournament.rev');
    }

    public function test_open_tournament_rev_changes_on_join_only(): void
    {
        $t = Tournament::create(['name' => 'K', 'size' => 8, 'status' => 'open', 'active' => true, 'players' => [['id' => 1, 'name' => 'A']]]);
        $rev = $this->rev($t);

        $this->get("/api/tournaments/{$t->id}?rev={$rev}")->assertNoContent();

        $t->update(['players' => [['id' => 1, 'name' => 'A'], ['id' => 2, 'name' => 'B']]]);
        $this->getJson("/api/tournaments/{$t->id}?rev={$rev}")->assertOk()->assertJsonPath('tournament.count', 2);
    }

    public function test_running_tournament_rev_changes_only_on_match_result(): void
    {
        $bracket = [[['key' => 'r0m0', 'p1' => ['id' => 1, 'name' => 'A'], 'p2' => ['id' => 2, 'name' => 'B'], 'winner' => null]]];
        $t = Tournament::create(['name' => 'K', 'size' => 2, 'status' => 'running', 'active' => true,
            'players' => [['id' => 1, 'name' => 'A'], ['id' => 2, 'name' => 'B']], 'bracket' => $bracket]);
        $rev = $this->rev($t);

        // Maç odası açıldı (room + target yazıldı) -> sonuç yok -> değişmedi.
        $bracket[0][0]['room'] = 'ABCDE';
        $bracket[0][0]['target'] = 5;
        $t->update(['bracket' => $bracket]);
        $this->get("/api/tournaments/{$t->id}?rev={$rev}")->assertNoContent();

        // Maç bitti -> yeni sürüm.
        $bracket[0][0]['winner'] = 1;
        $t->update(['bracket' => $bracket]);
        $this->getJson("/api/tournaments/{$t->id}?rev={$rev}")->assertOk();
    }

    // CANLI SKOR: /viewers suren maclarin anlik mac skorunu USER ID ile anahtarli dondurur
    // (bracket'te oda icine girmeden gorunur). white=p1_user, black=p2_user.
    public function test_viewers_endpoint_returns_live_scores_by_user_id(): void
    {
        $bracket = [[['key' => 'r0m0', 'room' => 'ABCDE', 'p1' => ['id' => 7, 'name' => 'A'], 'p2' => ['id' => 9, 'name' => 'B'], 'winner' => null]]];
        $t = Tournament::create(['name' => 'K', 'size' => 2, 'status' => 'running', 'active' => true,
            'players' => [['id' => 7, 'name' => 'A'], ['id' => 9, 'name' => 'B']], 'bracket' => $bracket]);

        Room::create([
            'code' => 'ABCDE', 'p1_token' => 't1', 'p1_name' => 'A', 'p1_user_id' => 7,
            'p2_token' => 't2', 'p2_name' => 'B', 'p2_user_id' => 9, 'status' => 'playing',
            'server_match' => ['target' => 3, 'score' => ['white' => 2, 'black' => 1], 'done' => false],
        ]);

        $this->getJson("/api/tournaments/{$t->id}/viewers")
            ->assertOk()
            ->assertJsonPath('scores.ABCDE.7', 2)  // p1 (white) = 2
            ->assertJsonPath('scores.ABCDE.9', 1); // p2 (black) = 1
    }

    // UCTAN UCA (cok puanli): gercek bir OYUN bitince (resign) server_match.score mac SURERKEN artar
    // ve /viewers bunu CANLI yansitir. target=3 -> ilk oyun beyaza (single) -> skor 1-0, mac BITMEDI.
    public function test_multipoint_live_score_updates_mid_match_via_real_game_end(): void
    {
        $p1 = User::factory()->create(['id' => 10]);
        $p2 = User::factory()->create(['id' => 20]);
        $bracket = [[['key' => 'r0m0', 'room' => 'AUTHX', 'target' => 3,
            'p1' => ['id' => 10, 'name' => 'A'], 'p2' => ['id' => 20, 'name' => 'B'], 'winner' => null]]];
        $t = Tournament::create(['name' => 'K3', 'size' => 2, 'status' => 'running', 'active' => true,
            'match_length' => 3, 'players' => [['id' => 10, 'name' => 'A'], ['id' => 20, 'name' => 'B']], 'bracket' => $bracket]);

        // 3 puanlik mac, 0-0, oyun suruyor. Siyah 1 tas topladi (single) -> resign single = beyaz +1.
        $sm = ['target' => 3, 'score' => ['white' => 0, 'black' => 0], 'gameNo' => 1, 'done' => false,
            'winner' => null, 'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
            'crawford' => false, 'crawfordDone' => false, 'opened' => true];
        $single = array_merge(Backgammon::initialState(), ['off' => ['white' => 0, 'black' => 1]]);
        Room::create([
            'code' => 'AUTHX', 'p1_token' => 'p1', 'p1_name' => 'A', 'p1_user_id' => 10,
            'p2_token' => 'p2', 'p2_name' => 'B', 'p2_user_id' => 20, 'status' => 'playing',
            'version' => 0, 'target' => 3, 'authoritative' => true,
            'server_state' => $single, 'server_match' => $sm,
        ]);

        // Siyah pes eder -> gercek oyun-sonu yolu: beyaz skoru 1, mac BITMEDI (1 < 3).
        Sanctum::actingAs($p2);
        $this->postJson('/api/rooms/AUTHX/resign', [
            'token' => 'p2', 'command_id' => (string) Str::uuid(),
            'expected_version' => (int) Room::where('code', 'AUTHX')->first()->server_version,
        ])->assertOk()->assertJsonPath('match_done', false);
        $this->assertSame(1, Room::where('code', 'AUTHX')->first()->server_match['score']['white']);

        // /viewers CANLI skoru yansitir: beyaz(p1=10)=1, siyah(p2=20)=0; bracket kazanani YOK.
        $this->getJson("/api/tournaments/{$t->id}/viewers")
            ->assertOk()
            ->assertJsonPath('scores.AUTHX.10', 1)
            ->assertJsonPath('scores.AUTHX.20', 0);
    }
}
