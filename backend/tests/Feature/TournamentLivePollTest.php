<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\Tournament;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
