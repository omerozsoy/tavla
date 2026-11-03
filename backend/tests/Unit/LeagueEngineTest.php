<?php

namespace Tests\Unit;

use App\Models\LeagueSeason;
use App\Support\League\LeagueEngine;
use PHPUnit\Framework\TestCase;

/**
 * Lig motoru (SAF) birim testleri — DB gerekmez. §3/§5/§6/§18 kurallarının çekirdeğini doğrular.
 */
class LeagueEngineTest extends TestCase
{
    /** @return array<int,array{id:int,name:string,rating:int}> */
    private function players(int $n): array
    {
        $out = [];
        for ($i = 1; $i <= $n; $i++) {
            $out[] = ['id' => $i, 'name' => "P$i", 'rating' => 1400 + $i]; // farklı rating -> 4. ölçüt belirgin
        }

        return $out;
    }

    /** 48 oyuncu, 8 tur: hiçbir çift TEKRAR eşleşmez; her oyuncu tam 8 maç oynar (§3, §6). */
    public function test_full_season_48_players_no_rematch_over_8_rounds(): void
    {
        $parts = LeagueEngine::initParticipants($this->players(48), 'season-A');
        $seenPairs = [];

        for ($r = 1; $r <= LeagueSeason::LEAGUE_ROUNDS; $r++) {
            $pr = LeagueEngine::pairRound($parts, $r, 'season-A', $r === 1);
            $this->assertTrue($pr['ok'], "round $r eşleşme üretemedi");
            $this->assertNull($pr['bye'], "48 çift sayı -> bay olmamalı (round $r)");
            $this->assertSame(0, $pr['report']['rematches'], "round $r tekrar-rakip üretti");
            $this->assertCount(24, $pr['matches'], "round $r 24 maç olmalı");

            foreach ($pr['matches'] as [$a, $b]) {
                $key = min($a, $b).'-'.max($a, $b);
                $prev = $seenPairs[$key] ?? null;
                $this->assertArrayNotHasKey($key, $seenPairs, "tekrar rakip r$r: $key (ilk tur: $prev)");
                $seenPairs[$key] = $r;
                // Deterministik kazanan: küçük id (sonuç dağılımı testin konusu değil, eşsizlik konusu)
                $parts = LeagueEngine::applyMatch($parts, min($a, $b), max($a, $b));
            }
        }

        // Her oyuncu 8 gerçek rakip gördü.
        foreach ($parts as $p) {
            $this->assertCount(8, $p['opponents'], "oyuncu {$p['id']} 8 maç oynamadı");
        }
    }

    /** Tek sayıda (33) oyuncu: her tur TAM bir bay; bay +1 puan; 8 turda bay tekrar etmez (§6 önceliği). */
    public function test_odd_player_bye_rotation_and_point(): void
    {
        $parts = LeagueEngine::initParticipants($this->players(33), 'season-B');
        $byeCount = [];

        for ($r = 1; $r <= LeagueSeason::LEAGUE_ROUNDS; $r++) {
            $pr = LeagueEngine::pairRound($parts, $r, 'season-B', $r === 1);
            $this->assertTrue($pr['ok'], "round $r");
            $this->assertNotNull($pr['bye'], "33 tek sayı -> her tur bir bay (round $r)");
            $this->assertCount(16, $pr['matches'], "round $r 16 maç + 1 bay");

            $byeId = $pr['bye'];
            $byeCount[$byeId] = ($byeCount[$byeId] ?? 0) + 1;
            $this->assertLessThanOrEqual(1, $byeCount[$byeId], "bay önceliği ihlali: $byeId iki kez bay geçti");

            $parts = LeagueEngine::applyBye($parts, $byeId, $r);
            foreach ($pr['matches'] as [$a, $b]) {
                $parts = LeagueEngine::applyMatch($parts, min($a, $b), max($a, $b));
            }
        }

        // Bay geçenlerin lig puanı bayından etkilenir (en az bay sayısı kadar).
        foreach ($parts as $p) {
            $this->assertSame((int) $p['wins'] + (int) $p['byes'], (int) $p['points'], "puan = wins+byes olmalı ({$p['id']})");
        }
    }

    /** 2. ölçüt (karşılaşılan rakiplerin toplam puanı) doğru hesaplanır. */
    public function test_buchholz_opponent_points_sum(): void
    {
        $parts = LeagueEngine::initParticipants($this->players(4), 'season-C');
        // Deterministik seed sırasından bağımsız, id ile uygula:
        $parts = LeagueEngine::applyMatch($parts, 1, 2); // 1 yendi 2
        $parts = LeagueEngine::applyMatch($parts, 3, 4); // 3 yendi 4
        $parts = LeagueEngine::applyMatch($parts, 1, 3); // 1 yendi 3
        $parts = LeagueEngine::applyMatch($parts, 2, 4); // 2 yendi 4

        $rows = LeagueEngine::standings($parts);
        $byId = [];
        foreach ($rows as $row) {
            $byId[$row['id']] = $row;
        }

        // Puanlar: 1=2, 2=1, 3=1, 4=0
        $this->assertSame(2, $byId[1]['points']);
        $this->assertSame(0, $byId[4]['points']);
        // 1'in rakipleri {2,3} -> oppPoints = 1 + 1 = 2
        $this->assertSame(2, $byId[1]['oppPoints']);
        // 1 lig birincisi
        $this->assertSame(1, $byId[1]['rank']);
        // 1'in yendikleri {2,3} -> beatenPoints = 1 + 1 = 2
        $this->assertSame(2, $byId[1]['beatenPoints']);
    }

    /** 4. ölçüt: eşit puan/oppPoints/beatenPoints'te güncel rating ayırır (DESC). */
    public function test_rating_breaks_otherwise_equal_standing(): void
    {
        // İki oyuncu hiç oynamamış (hepsi eşit, oppPoints/beaten=0); yüksek rating üstte.
        $parts = LeagueEngine::initParticipants([
            ['id' => 10, 'name' => 'Low', 'rating' => 1500],
            ['id' => 11, 'name' => 'High', 'rating' => 1900],
        ], 'season-D');

        $rows = LeagueEngine::standings($parts);
        $this->assertSame(11, $rows[0]['id'], 'yüksek rating üstte olmalı');
        $this->assertSame(10, $rows[1]['id']);
    }
}
