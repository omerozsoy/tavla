<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Regresyon: ping'teki tournament_matches (oto-giriş notice'ı) double_loss ile BİTMİŞ maçı
 * YOLLAMAMALI. Yollarsa client oto-girer -> enter() "Maç bitti." 422 -> catch tekrar dener ->
 * sonsuz "Maç bitti" toast döngüsü (Starck+Karamahmutoğlu T#72 r1m18, 2026-11-23).
 */
class TournamentMatchNoticeTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $nick): User
    {
        return User::create([
            'first_name' => $nick, 'last_name' => 'T', 'country' => '',
            'nickname' => $nick, 'email' => $nick.'@example.com',
            'password' => bcrypt('secret123'), 'rating' => 1500,
        ]);
    }

    private function runningTournament(User $p1, User $p2, array $matchExtra): Tournament
    {
        $players = [
            ['id' => $p1->id, 'name' => $p1->nickname, 'rating' => 1500, 'premium' => false],
            ['id' => $p2->id, 'name' => $p2->nickname, 'rating' => 1500, 'premium' => false],
        ];
        $match = array_merge([
            'key' => 'r0m0',
            'p1' => ['id' => $p1->id, 'name' => $p1->nickname],
            'p2' => ['id' => $p2->id, 'name' => $p2->nickname],
        ], $matchExtra);

        return Tournament::create([
            'name' => 'Swiss Notice', 'type' => 'swiss_triple', 'size' => 0,
            'status' => 'running', 'players' => $players, 'match_length' => 5,
            'bracket' => [[$match]],
        ]);
    }

    public function test_double_loss_match_not_in_ping_notice(): void
    {
        $p1 = $this->user('dln_a');
        $p2 = $this->user('dln_b');
        $this->runningTournament($p1, $p2, ['double_loss' => true]);

        Sanctum::actingAs($p1);
        $tm = $this->postJson('/api/ping')->assertOk()->json('tournament_matches');

        $this->assertCount(0, $tm, 'çift-mağlubiyetle biten maç oto-giriş notice\'ında olmamalı');
    }

    public function test_open_match_still_in_ping_notice(): void
    {
        $p1 = $this->user('opn_a');
        $p2 = $this->user('opn_b');
        $this->runningTournament($p1, $p2, []); // winner yok, double_loss yok -> oynanacak

        Sanctum::actingAs($p1);
        $tm = $this->postJson('/api/ping')->assertOk()->json('tournament_matches');

        $this->assertCount(1, $tm, 'oynanmayı bekleyen maç notice\'ta olmalı');
        $this->assertSame('r0m0', $tm[0]['match']);
    }
}
