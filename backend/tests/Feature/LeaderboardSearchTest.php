<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * /api/leaderboard/search — ilk 100'de olmayanlar kendini isme gore burada bulur.
 * Donen satirda GERCEK global sira (rank) olmali; <2 harf -> bos.
 */
class LeaderboardSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Setting::put('pr_min_matches', 1);
        Setting::put('pr_min_decisions', 1);
    }

    private function user(string $nick, int $rating, ?float $pr = null): User
    {
        $u = User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com', 'password' => bcrypt('secret123'),
        ]);
        $u->forceFill([
            'rating' => $rating,
            'career_pr' => $pr,
            'career_pr_matches' => $pr !== null ? 5 : 0,
            'career_pr_decisions' => $pr !== null ? 200 : 0,
        ])->save();

        return $u;
    }

    public function test_short_query_returns_empty(): void
    {
        $this->user('ahmet', 1500);
        $this->assertSame([], $this->getJson('/api/leaderboard/search?q=a')->assertOk()->json('players'));
    }

    public function test_finds_player_with_real_rank(): void
    {
        $this->user('top1', 2000);
        $this->user('top2', 1900);
        $target = $this->user('zuhal', 1600); // listede 3. sirada

        $players = $this->getJson('/api/leaderboard/search?q=zuh&by=rating')->assertOk()->json('players');

        $this->assertCount(1, $players);
        $this->assertSame($target->id, $players[0]['id']);
        $this->assertSame(3, $players[0]['rank']); // kendisinden ustte 2 kisi -> sira 3
    }

    public function test_name_match_is_word_start_and_case_tolerant(): void
    {
        $this->user('Mehmet', 1500);
        // KELİME-BAŞI eşleşme (substring DEĞİL): "meh" -> "Mehmet"; büyük/küçük harf farketmez.
        $players = $this->getJson('/api/leaderboard/search?q=MEH&by=rating')->assertOk()->json('players');
        $this->assertCount(1, $players);
        $this->assertSame('Mehmet', $players[0]['name']);

        // Ortadaki harf dizisi (kelime başı DEĞİL) artık eşleşmez: "ehm" -> hiç sonuç.
        $this->assertSame([], $this->getJson('/api/leaderboard/search?q=ehm&by=rating')->assertOk()->json('players'));
    }

    public function test_name_match_matches_second_word_start(): void
    {
        $u = $this->user('ali', 1500);
        $u->forceFill(['first_name' => 'Ali Veli'])->save();
        // İkinci kelimenin başı da eşleşir: "vel" -> "Ali Veli".
        $players = $this->getJson('/api/leaderboard/search?q=vel&by=rating')->assertOk()->json('players');
        $this->assertCount(1, $players);
        $this->assertSame($u->id, $players[0]['id']);
    }

    public function test_pr_search_ranks_among_qualified_only(): void
    {
        $this->user('pa', 1500, 2.0);
        $this->user('pb', 1500, 3.0);
        $target = $this->user('pcarol', 1500, 4.0); // 3. en iyi PR
        $this->user('pnone', 1500, null);           // PR yok -> aranamaz

        $players = $this->getJson('/api/leaderboard/search?q=pca&by=pr')->assertOk()->json('players');
        $this->assertCount(1, $players);
        $this->assertSame($target->id, $players[0]['id']);
        $this->assertSame(3, $players[0]['rank']);

        // PR'siz oyuncu PR aramasinda cikmaz
        $this->assertSame([], $this->getJson('/api/leaderboard/search?q=pnone&by=pr')->assertOk()->json('players'));
    }
}
