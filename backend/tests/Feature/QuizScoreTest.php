<?php

namespace Tests\Feature;

use App\Models\QuizScore;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Soru Maratonu anonim skor tabelası: submit (doğrulama + rank) ve leaderboard (score desc).
 * Giriş gerekmez. Takma-ad trim/strip/cap, skor aralık doğrulaması.
 */
class QuizScoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_submit_inserts_and_returns_rank(): void
    {
        $res = $this->postJson('/api/quiz-marathon/score', [
            'nickname' => 'Ahmet', 'score' => 325, 'correct_count' => 12,
        ]);
        $res->assertStatus(201)->assertJson(['ok' => true]);
        $this->assertGreaterThanOrEqual(1, $res->json('rank'));
        $this->assertSame(1, QuizScore::count());
        $this->assertSame('Ahmet', QuizScore::first()->nickname);
    }

    public function test_logged_in_user_nickname_overrides_client_nickname(): void
    {
        Sanctum::actingAs(User::factory()->create(['nickname' => 'TavlaUstasi']));
        $this->postJson('/api/quiz-marathon/score', [
            'nickname' => 'Sahte', 'score' => 50, 'correct_count' => 2,
        ])->assertStatus(201);
        $this->assertSame('TavlaUstasi', QuizScore::first()->nickname);
    }

    public function test_leaderboard_orders_by_score_desc(): void
    {
        foreach ([100, 300, 200] as $s) {
            $this->postJson('/api/quiz-marathon/score', ['nickname' => "u$s", 'score' => $s, 'correct_count' => 1]);
        }
        $res = $this->getJson('/api/quiz-marathon/leaderboard');
        $res->assertOk();
        $players = $res->json('players');
        $this->assertSame(300, $players[0]['score']);
        $this->assertSame(1, $players[0]['rank']);
        $this->assertSame(100, $players[2]['score']);
    }

    public function test_leaderboard_dedupes_nickname_keeping_highest(): void
    {
        // Aynı oyuncu (Ali) 3 kez oynadı; tabelada YALNIZ en yüksek skoruyla (300) 1 kez olmalı.
        foreach ([120, 300, 90] as $s) {
            $this->postJson('/api/quiz-marathon/score', ['nickname' => 'Ali', 'score' => $s, 'correct_count' => 1]);
        }
        $this->postJson('/api/quiz-marathon/score', ['nickname' => 'Veli', 'score' => 200, 'correct_count' => 1]);

        $players = $this->getJson('/api/quiz-marathon/leaderboard')->assertOk()->json('players');
        $this->assertCount(2, $players);
        $this->assertSame('Ali', $players[0]['nickname']);
        $this->assertSame(300, $players[0]['score']);
        $this->assertSame('Veli', $players[1]['nickname']);
    }

    public function test_nickname_trimmed_capped_stripped(): void
    {
        $this->postJson('/api/quiz-marathon/score', [
            'nickname' => '  <b>'.str_repeat('x', 25).'  ', 'score' => 10, 'correct_count' => 1,
        ])->assertStatus(201);
        $nick = QuizScore::first()->nickname;
        $this->assertLessThanOrEqual(20, mb_strlen($nick));
        $this->assertStringNotContainsString('<', $nick);

        $this->postJson('/api/quiz-marathon/score', [
            'nickname' => '   ', 'score' => 10, 'correct_count' => 1,
        ])->assertStatus(201);
        $this->assertSame('Oyuncu', QuizScore::orderByDesc('id')->first()->nickname);
    }

    public function test_invalid_score_rejected(): void
    {
        $this->postJson('/api/quiz-marathon/score', ['nickname' => 'a', 'score' => -5, 'correct_count' => 1])->assertStatus(422);
        $this->postJson('/api/quiz-marathon/score', ['nickname' => 'a', 'score' => 0, 'correct_count' => 0])->assertStatus(422);
        $this->postJson('/api/quiz-marathon/score', ['nickname' => 'a', 'score' => 'abc', 'correct_count' => 1])->assertStatus(422);
        $this->postJson('/api/quiz-marathon/score', ['nickname' => 'a', 'score' => 999999999, 'correct_count' => 1])->assertStatus(422);
    }
}
