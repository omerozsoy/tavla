<?php

namespace Tests\Unit;

use App\Support\Swiss\SwissEngine;
use PHPUnit\Framework\TestCase;

/**
 * "3 Haklı Swiss" saf motor testleri (contract §18). DB gerektirmez.
 */
class SwissEngineTest extends TestCase
{
    /** @return array<int,array{id:int,name:string,rating:int}> */
    private function players(int $n): array
    {
        $out = [];
        for ($i = 1; $i <= $n; $i++) {
            $out[] = ['id' => $i, 'name' => "P$i", 'rating' => 1500 + $i];
        }

        return $out;
    }

    /**
     * Deterministik simülasyon sürücüsü: her turu eşleştir, sonuçları uygula (kazanan = hash ile
     * pseudo-rastgele ama deterministik), bay uygula, deltaları işle. Turnuva bitene kadar. Her turda
     * değişmezleri doğrular.
     *
     * @return array{participants:array,rounds:int,byes:array<int,int>,pairings:array}
     */
    private function simulate(array $players, string $seed, bool $assertInvariants = true): array
    {
        $parts = SwissEngine::initParticipants($players, $seed);
        $round = 0;
        $allPairings = [];
        $byeCount = [];
        $guard = 0;

        while (! SwissEngine::isComplete($parts)) {
            $guard++;
            $this->assertLessThan(1000, $guard, 'Turnuva sonlanmadı (sonsuz döngü)');
            $round++;
            $pr = SwissEngine::pairRound($parts, $round, $seed);
            $allPairings[$round] = $pr;

            if ($assertInvariants) {
                $this->assertPairingInvariants($parts, $pr);
            }

            // Deltaları (float yönü) işle — sonraki tur cezası için.
            foreach ($pr['deltas'] as $id => $d) {
                foreach ($parts as &$p) {
                    if ((int) $p['id'] === (int) $id) {
                        $p['lastGroupDelta'] = $d;
                    }
                }
                unset($p);
            }

            // Bay
            if ($pr['bye'] !== null) {
                $parts = SwissEngine::applyBye($parts, $pr['bye'], $round);
            }

            // Maç sonuçları — kazanan deterministik pseudo-rastgele.
            foreach ($pr['matches'] as $m) {
                [$x, $y] = $m;
                $h = hexdec(substr(hash('sha256', "$seed:$round:$x:$y"), 0, 8));
                $winner = ($h % 2 === 0) ? $x : $y;
                $loser = $winner === $x ? $y : $x;
                $parts = SwissEngine::applyResult($parts, $winner, $loser, $round, true);
            }
        }

        foreach ($parts as $p) {
            if (! empty($p['byeRounds'])) {
                $byeCount[(int) $p['id']] = count($p['byeRounds']);
            }
        }

        return ['participants' => $parts, 'rounds' => $round, 'byes' => $byeCount, 'pairings' => $allPairings];
    }

    private function assertPairingInvariants(array $parts, array $pr): void
    {
        $active = SwissEngine::active($parts);
        $activeIds = array_map(fn ($p) => (int) $p['id'], $active);

        $covered = [];
        foreach ($pr['matches'] as $m) {
            [$a, $b] = $m;
            $this->assertNotSame($a, $b, 'Oyuncu kendisiyle eşleşemez');
            $this->assertContains($a, $activeIds, 'Eşleşen oyuncu aktif olmalı');
            $this->assertContains($b, $activeIds, 'Eşleşen oyuncu aktif olmalı');
            $this->assertArrayNotHasKey($a, $covered, "Oyuncu $a bir turda iki kez yer alamaz");
            $this->assertArrayNotHasKey($b, $covered, "Oyuncu $b bir turda iki kez yer alamaz");
            $covered[$a] = true;
            $covered[$b] = true;
        }
        if ($pr['bye'] !== null) {
            $this->assertContains($pr['bye'], $activeIds, 'Bay aktif oyuncuya verilmeli');
            $this->assertArrayNotHasKey($pr['bye'], $covered, 'Bay oyuncusu maça da atanamaz');
            $covered[$pr['bye']] = true;
        }

        // Tam kapsama: her aktif oyuncu tam bir kez.
        $this->assertCount(count($activeIds), $covered, 'Her aktif oyuncu tam bir kez kapsanmalı');

        // Bay parity: çift => bay yok, tek => tam bir bay.
        if (count($activeIds) % 2 === 0) {
            $this->assertNull($pr['bye'], 'Çift sayıda oyuncuda bay verilmez');
        } else {
            $this->assertNotNull($pr['bye'], 'Tek sayıda oyuncuda tam bir bay verilir');
        }
    }

    // ---- Kural testleri ------------------------------------------------------

    public function test_first_and_second_loss_continue_third_eliminates(): void
    {
        $p = SwissEngine::initParticipants($this->players(2), 's');
        $p = SwissEngine::applyResult($p, 1, 2, 1, true); // 2: 1 mağlubiyet
        $this->assertSame('active', SwissEngine::find($p, 2)['status']);
        $this->assertSame(2, SwissEngine::remainingLives(SwissEngine::find($p, 2)));

        $p = SwissEngine::applyResult($p, 1, 2, 2, true); // 2: 2 mağlubiyet
        $this->assertSame('active', SwissEngine::find($p, 2)['status']);
        $this->assertSame(1, SwissEngine::remainingLives(SwissEngine::find($p, 2)));

        $p = SwissEngine::applyResult($p, 1, 2, 3, true); // 2: 3 mağlubiyet -> elenir
        $this->assertSame('eliminated', SwissEngine::find($p, 2)['status']);
        $this->assertSame(3, SwissEngine::find($p, 2)['eliminatedRound']);
        $this->assertSame(0, SwissEngine::remainingLives(SwissEngine::find($p, 2)));
        $this->assertSame(1, SwissEngine::championId($p));
    }

    public function test_lives_count_is_configurable(): void
    {
        // 1 haklı: ilk yenilgide elenir (tek-eleme gibi).
        $p = SwissEngine::initParticipants($this->players(2), 's', 1);
        $this->assertSame(1, SwissEngine::remainingLives(SwissEngine::find($p, 2)));
        $p = SwissEngine::applyResult($p, 1, 2, 1, true);
        $this->assertSame('eliminated', SwissEngine::find($p, 2)['status'], '1 haklı: ilk yenilgide elenir');
        $this->assertSame(1, SwissEngine::championId($p));

        // 2 haklı: 2. yenilgide elenir, 1. yenilgide değil.
        $p = SwissEngine::initParticipants($this->players(2), 's', 2);
        $this->assertSame(2, SwissEngine::remainingLives(SwissEngine::find($p, 2)));
        $p = SwissEngine::applyResult($p, 1, 2, 1, true);
        $this->assertSame('active', SwissEngine::find($p, 2)['status'], '2 haklı: 1. yenilgi elemez');
        $p = SwissEngine::applyResult($p, 1, 2, 2, true);
        $this->assertSame('eliminated', SwissEngine::find($p, 2)['status'], '2 haklı: 2. yenilgide elenir');

        // Sınır dışı değer kıstırılır (0 -> 1, 9 -> 3).
        $this->assertSame(1, SwissEngine::livesCap(['lives' => 0]));
        $this->assertSame(3, SwissEngine::livesCap(['lives' => 9]));
        $this->assertSame(3, SwissEngine::livesCap([]), 'Eski kayıt (lives yok) -> MAX_LIVES');
    }

    public function test_winning_does_not_restore_a_life(): void
    {
        $p = SwissEngine::initParticipants($this->players(2), 's');
        $p = SwissEngine::applyResult($p, 1, 2, 1, true); // 2 kaybetti (1 loss)
        $p = SwissEngine::applyResult($p, 2, 1, 2, true); // 2 kazandı
        $this->assertSame(1, SwissEngine::find($p, 2)['losses'], 'Kazanmak hakkı geri getirmez');
        $this->assertSame(2, SwissEngine::remainingLives(SwissEngine::find($p, 2)));
    }

    public function test_bye_gives_progression_win_but_no_loss_no_real_win(): void
    {
        $p = SwissEngine::initParticipants($this->players(3), 's');
        $p = SwissEngine::applyBye($p, 1, 1);
        $me = SwissEngine::find($p, 1);
        $this->assertSame(1, $me['wins'], 'Bay ilerleme galibiyeti verir');
        $this->assertSame(0, $me['realWins'], 'Bay gerçek maç galibiyeti değildir');
        $this->assertSame(0, $me['losses'], 'Bay mağlubiyet yaratmaz');
        $this->assertSame(1, $me['byes']);
    }

    public function test_forfeit_counts_loss_but_not_real_match(): void
    {
        $p = SwissEngine::initParticipants($this->players(2), 's');
        $p = SwissEngine::applyResult($p, 1, 2, 1, false); // hükmen
        $w = SwissEngine::find($p, 1);
        $l = SwissEngine::find($p, 2);
        $this->assertSame(1, $w['wins']);
        $this->assertSame(0, $w['realWins'], 'Hükmen gerçek galibiyet değil');
        $this->assertSame(1, $l['losses'], 'Hükmen mağlubiyet sayılır');
        $this->assertNotContains(2, $w['opponents'], 'Hükmen rakip geçmişine yazılmaz');
    }

    public function test_withdraw_and_dq_do_not_fabricate_three_losses(): void
    {
        $p = SwissEngine::initParticipants($this->players(4), 's');
        $p = SwissEngine::applyWithdraw($p, 3, 2, false);
        $this->assertSame('withdrawn', SwissEngine::find($p, 3)['status']);
        $this->assertSame(0, SwissEngine::find($p, 3)['losses'], 'Çekilme yapay mağlubiyet yaratmaz');

        $p = SwissEngine::applyDisqualify($p, 4, 2);
        $this->assertSame('dq', SwissEngine::find($p, 4)['status']);
        $this->assertSame(0, SwissEngine::find($p, 4)['losses'], 'DQ yapay mağlubiyet yaratmaz');
    }

    public function test_losses_never_exceed_three_or_go_negative(): void
    {
        foreach ([8, 16, 32] as $n) {
            $r = $this->simulate($this->players($n), "seed-$n");
            foreach ($r['participants'] as $p) {
                $this->assertGreaterThanOrEqual(0, $p['losses']);
                $this->assertLessThanOrEqual(3, $p['losses']);
            }
        }
    }

    // ---- Eşleştirme testleri -------------------------------------------------

    public function test_pairing_coverage_and_bye_for_all_sizes(): void
    {
        foreach ([2, 3, 4, 5, 7, 8, 16, 31, 32, 64, 128] as $n) {
            $r = $this->simulate($this->players($n), "cov-$n");
            $this->assertSame(1, count(SwissEngine::active($r['participants'])), "$n oyuncu: tek şampiyon kalmalı");
            $this->assertNotNull(SwissEngine::championId($r['participants']), "$n oyuncu: şampiyon belirlenmeli");
        }
    }

    public function test_no_rematch_when_avoidable(): void
    {
        // 4 oyuncu: R1 sonrası kazananlar ve kaybedenler kendi içinde eşleşir -> tekrar rakip GEREKMEZ.
        $p = SwissEngine::initParticipants($this->players(4), 'nr');
        $r1 = SwissEngine::pairRound($p, 1, 'nr');
        // R1 sonuçlarını uygula: her maçın ilk oyuncusu kazansın.
        foreach ($r1['matches'] as [$a, $b]) {
            $p = SwissEngine::applyResult($p, $a, $b, 1, true);
        }
        $r2 = SwissEngine::pairRound($p, 2, 'nr');
        foreach ($r2['matches'] as [$a, $b]) {
            $pa = SwissEngine::find($p, $a);
            $this->assertNotContains($b, $pa['opponents'], 'Kaçınılabilir tekrar rakip çıkmamalı');
        }
        $this->assertSame(0, $r2['report']['rematches'] === [] ? 0 : count($r2['report']['rematches']));
    }

    public function test_forced_rematch_does_not_deadlock(): void
    {
        // 2 oyuncu, biri 2 mağlubiyetli -> tekrar oynamak zorunda (final aşaması). Kilitlenmemeli.
        $p = SwissEngine::initParticipants($this->players(2), 'fr');
        $p = SwissEngine::applyResult($p, 1, 2, 1, true); // R1: 2 kaybetti, ayrıca rakip oldular
        $r2 = SwissEngine::pairRound($p, 2, 'fr');
        $this->assertCount(1, $r2['matches'], 'İki oyuncu tekrar eşleşmeli (zorunlu rematch)');
        $this->assertNull($r2['bye']);
        $this->assertContains($r2['matches'][0][0], [1, 2]);
    }

    public function test_determinism_same_seed_same_pairings(): void
    {
        $a = $this->simulate($this->players(16), 'DET');
        $b = $this->simulate($this->players(16), 'DET');
        $this->assertEquals(
            array_map(fn ($pr) => [$pr['matches'], $pr['bye']], $a['pairings']),
            array_map(fn ($pr) => [$pr['matches'], $pr['bye']], $b['pairings']),
            'Aynı seed aynı eşleştirmeyi üretmeli'
        );
    }

    public function test_bye_priority_prefers_fewest_byes_then_most_losses(): void
    {
        $p = SwissEngine::initParticipants($this->players(3), 'by');
        // 1: zaten 1 bay almış; 2: 0 bay 1 mağlubiyet; 3: 0 bay 0 mağlubiyet.
        $p = SwissEngine::applyBye($p, 1, 1);
        $p = SwissEngine::applyResult($p, 3, 2, 1, true); // 2: 1 mağlubiyet (ama R1'de bay 1'e verildi say)
        // Şimdi bay adayı: en az bay (2 ve 3, ikisi 0), sonra en çok mağlubiyet (2).
        $bye = SwissEngine::selectBye(SwissEngine::active($p));
        $this->assertSame(2, $bye, 'Bay: en az bay + en çok mağlubiyet olana gitmeli');
    }

    public function test_exhaustive_matching_is_optimal_small(): void
    {
        // Kurgu: R1'de 1-2, 3-4 oynadı. R2'de 4 oyuncu; optimal eşleştirme tekrar-rakipsiz olmalı.
        $p = SwissEngine::initParticipants($this->players(4), 'ex');
        // Rakip geçmişini elle kur: 1-2 ve 3-4 oynadı, hepsi 0-0 gibi (float yok) — yalnız rematch kaçınma.
        foreach ($p as &$x) {
            $x['losses'] = 0;
            $x['wins'] = 0;
            if ((int) $x['id'] === 1) {
                $x['opponents'] = [2];
            }
            if ((int) $x['id'] === 2) {
                $x['opponents'] = [1];
            }
            if ((int) $x['id'] === 3) {
                $x['opponents'] = [4];
            }
            if ((int) $x['id'] === 4) {
                $x['opponents'] = [3];
            }
        }
        unset($x);
        $r = SwissEngine::pairRound($p, 2, 'ex');
        $this->assertTrue($r['optimal']);
        $this->assertSame([], $r['report']['rematches'], 'Exhaustive optimal: tekrar rakip olmamalı');
    }

    // ---- Final testleri ------------------------------------------------------

    public function test_last_two_lives_not_reset_and_needs_rematches(): void
    {
        // A(id1): 0 mağlubiyet, B(id2): 2 mağlubiyet. B bir kez daha kaybederse elenir; A 1 kez
        // kaybederse 1 mağlubiyetle devam (contract §11 örneği).
        $p = SwissEngine::initParticipants($this->players(2), 'l2');
        $p = SwissEngine::applyResult($p, 1, 2, 1, true);
        $p = SwissEngine::applyResult($p, 1, 2, 2, true); // B: 2 mağlubiyet
        $this->assertSame(2, SwissEngine::find($p, 2)['losses']);
        $this->assertSame(0, SwissEngine::find($p, 1)['losses']);

        // A bir kez kaybeder -> elenmez.
        $p2 = SwissEngine::applyResult($p, 2, 1, 3, true);
        $this->assertSame('active', SwissEngine::find($p2, 1)['status']);
        $this->assertSame(1, SwissEngine::find($p2, 1)['losses'], 'Haklar sıfırlanmaz');
        $this->assertNull(SwissEngine::championId($p2), 'İki oyuncu da aktif; şampiyon yok');

        // B bir kez daha kaybeder -> elenir, A şampiyon.
        $p3 = SwissEngine::applyResult($p, 1, 2, 3, true);
        $this->assertSame('eliminated', SwissEngine::find($p3, 2)['status']);
        $this->assertSame(1, SwissEngine::championId($p3));
    }

    public function test_two_two_records_next_match_decides_champion(): void
    {
        $p = SwissEngine::initParticipants($this->players(2), '22');
        $p = SwissEngine::applyResult($p, 1, 2, 1, true);
        $p = SwissEngine::applyResult($p, 2, 1, 2, true);
        $p = SwissEngine::applyResult($p, 1, 2, 3, true);
        $p = SwissEngine::applyResult($p, 2, 1, 4, true); // her ikisi 2-2
        $this->assertSame(2, SwissEngine::find($p, 1)['losses']);
        $this->assertSame(2, SwissEngine::find($p, 2)['losses']);
        $this->assertNull(SwissEngine::championId($p));

        $p = SwissEngine::applyResult($p, 1, 2, 5, true); // sonraki maç şampiyonu belirler
        $this->assertSame(1, SwissEngine::championId($p));
    }

    public function test_single_player_completes_and_zero_players_no_champion(): void
    {
        $p = SwissEngine::initParticipants($this->players(1), 'one');
        $this->assertTrue(SwissEngine::isComplete($p));
        $this->assertSame(1, SwissEngine::championId($p));

        // Sıfır aktif: tümü çekildi -> şampiyon uydurulmaz.
        $p2 = SwissEngine::initParticipants($this->players(2), 'zero');
        $p2 = SwissEngine::applyWithdraw($p2, 1, 1, false);
        $p2 = SwissEngine::applyWithdraw($p2, 2, 1, false);
        $this->assertTrue(SwissEngine::isComplete($p2));
        $this->assertNull(SwissEngine::championId($p2), 'Hiç aktif yoksa şampiyon yok');
    }

    public function test_final_standings_shared_rank_for_same_elimination_round(): void
    {
        // 4 oyuncu; 2 ve 3 aynı turda elenirse ortak 3., sonraki 5. (contract §12).
        $p = SwissEngine::initParticipants($this->players(4), 'fs');
        // Elle kur: 2 ve 3 -> 3 mağlubiyet, R5'te elenmiş; 4 -> R6 elenmiş; 1 -> şampiyon.
        foreach ($p as &$x) {
            $id = (int) $x['id'];
            if ($id === 2 || $id === 3) {
                $x['losses'] = 3;
                $x['status'] = 'eliminated';
                $x['eliminatedRound'] = 5;
                $x['rating'] = 1500; // eşit rating -> tie-break kademesi tamamen eşit -> ORTAK derece
            } elseif ($id === 4) {
                $x['losses'] = 3;
                $x['status'] = 'eliminated';
                $x['eliminatedRound'] = 6;
            }
        }
        unset($x);
        $this->assertSame(1, SwissEngine::championId($p));
        $st = SwissEngine::finalStandings($p);
        $byId = [];
        foreach ($st as $row) {
            $byId[$row['id']] = $row;
        }
        $this->assertSame(1, $byId[1]['rank'], 'Şampiyon 1.');
        $this->assertSame(2, $byId[4]['rank'], 'Daha geç elenen (R6) 2.');
        $this->assertSame(3, $byId[2]['rank'], 'R5 elenenler ortak 3.');
        $this->assertSame(3, $byId[3]['rank'], 'R5 elenenler ortak 3.');
    }

    public function test_final_standings_bye_players_rank_below_non_bye_in_same_round(): void
    {
        // 5 oyuncu; 2,3,4 ve 5 aynı turda (R5) elendi; içlerinden 5 daha önce 1 bay çekti.
        // Şampiyon (1) hariç geç-elenen yok -> ilk grup 2.'den başlar.
        // Beklenti: bay çekmeyen 2,3,4 ORTAK 2.; bay çeken 5 onların ALTINDA 5.
        $p = SwissEngine::initParticipants($this->players(5), 'fsbye');
        foreach ($p as &$x) {
            $id = (int) $x['id'];
            if (in_array($id, [2, 3, 4, 5], true)) {
                $x['losses'] = 3;
                $x['status'] = 'eliminated';
                $x['eliminatedRound'] = 5;
                $x['rating'] = 1500; // eşit rating -> bay çekmeyenler kendi aralarında ORTAK
            }
            if ($id === 5) {
                $x['byes'] = 1;
            }
        }
        unset($x);
        $this->assertSame(1, SwissEngine::championId($p));
        $st = SwissEngine::finalStandings($p);
        $byId = [];
        foreach ($st as $row) {
            $byId[$row['id']] = $row;
        }
        $this->assertSame(1, $byId[1]['rank'], 'Şampiyon 1.');
        $this->assertSame(2, $byId[2]['rank'], 'Bay çekmeyen ortak 2.');
        $this->assertSame(2, $byId[3]['rank'], 'Bay çekmeyen ortak 2.');
        $this->assertSame(2, $byId[4]['rank'], 'Bay çekmeyen ortak 2.');
        $this->assertSame(5, $byId[5]['rank'], 'Bay çeken aynı turda olsa da ALTTA (5.)');
    }

    public function test_final_standings_tiebreak_cascade_wins_realwins_averaj_rating(): void
    {
        // 6 oyuncu; 2..6 aynı turda (R4) elendi, hepsi bay YOK. Kademe: wins > realWins > averaj > rating.
        $p = SwissEngine::initParticipants($this->players(6), 'fscascade');
        $set = [
            // id => [wins, realWins, pointsFor, pointsAgainst, rating]
            2 => [3, 3, 9, 3, 1000],   // en çok galibiyet -> 2.
            3 => [2, 2, 5, 0, 1500],   // wins2 rw2 averaj+5 -> 3.
            4 => [2, 2, 5, 0, 1000],   // 3 ile her şey eşit, rating düşük -> 4.
            5 => [2, 2, 2, 0, 9999],   // averaj +2 (düşük) rating çok yüksek olsa da -> 5.
            6 => [1, 1, 9, 0, 9999],   // en az galibiyet -> 6.
        ];
        foreach ($p as &$x) {
            $id = (int) $x['id'];
            if (isset($set[$id])) {
                [$w, $rw, $pf, $pa, $r] = $set[$id];
                $x['losses'] = 3;
                $x['status'] = 'eliminated';
                $x['eliminatedRound'] = 4;
                $x['wins'] = $w;
                $x['realWins'] = $rw;
                $x['pointsFor'] = $pf;
                $x['pointsAgainst'] = $pa;
                $x['rating'] = $r;
            }
        }
        unset($x);
        $this->assertSame(1, SwissEngine::championId($p));
        $byId = [];
        foreach (SwissEngine::finalStandings($p) as $row) {
            $byId[$row['id']] = $row;
        }
        $this->assertSame(1, $byId[1]['rank'], 'Şampiyon 1.');
        $this->assertSame(2, $byId[2]['rank'], 'En çok galibiyet 2.');
        $this->assertSame(3, $byId[3]['rank'], 'wins/rw/averaj eşit, rating yüksek 3.');
        $this->assertSame(4, $byId[4]['rank'], 'Aynı ama rating düşük 4.');
        $this->assertSame(5, $byId[5]['rank'], 'Averaj düşük (rating yüksek olsa da) 5.');
        $this->assertSame(6, $byId[6]['rank'], 'En az galibiyet 6.');
    }

    public function test_zero_active_fallback_champion_by_rating(): void
    {
        // Son iki oyuncu çift mağlubiyetle aynı anda elenir -> 0 aktif. TavlaTV: rating yüksek şampiyon.
        $p = SwissEngine::initParticipants($this->players(2), 'fb'); // rating: id1=1501, id2=1502
        $p = SwissEngine::applyResult($p, 1, 2, 1, true);
        $p = SwissEngine::applyResult($p, 2, 1, 2, true);
        $p = SwissEngine::applyResult($p, 1, 2, 3, true);
        $p = SwissEngine::applyResult($p, 2, 1, 4, true); // ikisi de 2-2, ikisi aktif
        $this->assertNull(SwissEngine::championId($p), 'Henüz ikisi aktif');
        $p = SwissEngine::applyDoubleLoss($p, 1, 2, 5); // ikisi de 3 mağlubiyet -> 0 aktif
        $this->assertTrue(SwissEngine::isComplete($p));
        $this->assertSame(2, SwissEngine::championId($p), 'Rating yüksek (id2=1502) fallback şampiyon');

        $st = SwissEngine::finalStandings($p);
        $byId = [];
        foreach ($st as $row) {
            $byId[$row['id']] = $row;
        }
        $this->assertSame(1, $byId[2]['rank'], 'Fallback şampiyon rank 1');
        $this->assertSame(2, $byId[1]['rank'], 'Diğer finalist rank 2');
        $this->assertCount(2, $st, 'Şampiyon elenen listesinde tekrar GÖSTERİLMEZ');
    }

    public function test_property_full_simulations_hold_invariants(): void
    {
        foreach ([2, 3, 5, 7, 8, 11, 16, 24, 32] as $n) {
            foreach (['a', 'b', 'c'] as $s) {
                $r = $this->simulate($this->players($n), "$s-$n");
                // Tam bir şampiyon.
                $this->assertNotNull(SwissEngine::championId($r['participants']), "$n/$s: şampiyon olmalı");
                // Mağlubiyet sınırları.
                foreach ($r['participants'] as $p) {
                    $this->assertLessThanOrEqual(3, $p['losses']);
                    $this->assertGreaterThanOrEqual(0, $p['losses']);
                    // Elenen tam 3 mağlubiyetli.
                    if ($p['status'] === 'eliminated') {
                        $this->assertSame(3, $p['losses'], "$n/$s: elenen 3 mağlubiyetli olmalı");
                    }
                    // Şampiyon <3 mağlubiyet.
                    if ($p['id'] === SwissEngine::championId($r['participants'])) {
                        $this->assertLessThan(3, $p['losses']);
                    }
                }
            }
        }
    }

    public function test_large_field_pairing_completes_within_budget(): void
    {
        // 128 oyuncu ilk tur — sezgisel yol; makul sürede bitmeli ve değişmezleri korumalı.
        $p = SwissEngine::initParticipants($this->players(128), 'big');
        $start = microtime(true);
        $r = SwissEngine::pairRound($p, 1, 'big');
        $elapsed = microtime(true) - $start;
        $this->assertLessThan(3.0, $elapsed, 'Büyük alan eşleştirmesi bütçede bitmeli');
        $this->assertCount(64, $r['matches']);
        $this->assertNull($r['bye']);
        $this->assertPairingInvariants($p, $r);
    }
}
