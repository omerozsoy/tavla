<?php

namespace App\Support\Swiss;

/**
 * "3 Haklı Swiss" / Swiss Triple Elimination — SAF (stateless) motor.
 *
 * TavlaTV ürün sözleşmesi (bu tür için; evrensel federasyon standardı DEĞİL):
 *  - Her katılımcı 3 hakla başlar; 3. maç mağlubiyetinde elenir. remainingLives = max(0, 3 - losses).
 *  - Hak, tamamlanmış bir TURNUVA MAÇI sonucuyla azalır (tavla eliyle/mars/hedef puanla değil).
 *  - Bay: turnuva galibiyeti verir, mağlubiyet/hak kaybı YOK, gerçek maç galibiyeti sayılmaz.
 *  - Kazanmak kaybedilen hakkı geri getirmez. Beraberlik yok.
 *  - Sabit tur sayısı yok; tek oyuncu kalana kadar devam (son 2/3 aynı Swiss+bay politikası).
 *  - "Turnuva galibiyeti" = ilerleme galibiyeti (bay + hükmen dahil). "Gerçek maç galibiyeti" ayrı tutulur.
 *
 * Bu sınıf DB'ye dokunmaz; yalnız katılımcı dizileri üzerinde çalışır. Deterministiktir: aynı
 * girdi + aynı seed + aynı ALGO_VERSION => aynı eşleştirme (contract §6).
 *
 * ponytail: küçük grupta (<=EXHAUSTIVE_MAX) global-optimal exhaustive eşleştirme; büyük grupta
 * grup-bazlı sezgisel + local swap (optimal DEĞİL, loglanır). Kanıtlı-optimal min-cost blossom
 * gerekirse ileride kütüphaneyle eklenir.
 */
class SwissEngine
{
    public const ALGO_VERSION = 1;

    public const MAX_LIVES = 3;

    /** Bu boyuta (kalan oyuncu, eşleştirilecek) kadar exhaustive global-optimal eşleştirme yap. */
    public const EXHAUSTIVE_MAX = 14; // (14-1)!! = 135135 matching — güvenli üst sınır

    /** Exhaustive arama için yumuşak süre sınırı (sn); aşılırsa sezgisele düş. */
    public const PAIR_TIME_LIMIT = 1.5;

    // ---- Katılımcı fabrikası -------------------------------------------------

    /**
     * @param  array<int,array{id:int,name?:string,rating?:int,avatar?:string|null,premium?:bool}>  $players
     * @return array<int,array<string,mixed>> seed sırasına göre katılımcılar (deterministik kura)
     */
    public static function initParticipants(array $players, string $seed): array
    {
        $players = array_values(array_filter($players, fn ($p) => ! empty($p['id'])));
        $ordered = self::seededShuffle($players, $seed, fn ($p) => (string) $p['id']);
        $out = [];
        foreach ($ordered as $i => $p) {
            $out[] = [
                'id' => (int) $p['id'],
                'name' => (string) ($p['name'] ?? ''),
                'rating' => (int) ($p['rating'] ?? 0),
                'avatar' => $p['avatar'] ?? null,
                'premium' => (bool) ($p['premium'] ?? false),
                'seed' => $i,          // kura sırası — nihai tie-break
                'losses' => 0,
                'wins' => 0,           // ilerleme galibiyeti (bay + hükmen dahil)
                'realWins' => 0,       // gerçekten oynanıp kazanılan
                'byes' => 0,
                'byeRounds' => [],
                'opponents' => [],     // gerçek maç oynanan rakip id'leri
                'eliminatedRound' => null,
                'withdrawnRound' => null,
                'status' => 'active',  // active | eliminated | withdrawn | dq
                'lastGroupDelta' => 0, // +1: geçen tur üst gruba float, -1: alt gruba, 0: yok
            ];
        }

        return $out;
    }

    // ---- Sorgular ------------------------------------------------------------

    /** @return array<int,array<string,mixed>> */
    public static function active(array $participants): array
    {
        return array_values(array_filter($participants, fn ($p) => ($p['status'] ?? 'active') === 'active'));
    }

    public static function remainingLives(array $p): int
    {
        return max(0, self::MAX_LIVES - (int) ($p['losses'] ?? 0));
    }

    /** Turnuva bitti mi? Bittiyse şampiyon id (tek aktif) yoksa null; hiç aktif kalmadıysa null. */
    public static function championId(array $participants): ?int
    {
        $act = self::active($participants);

        return count($act) === 1 ? (int) $act[0]['id'] : null;
    }

    public static function isComplete(array $participants): bool
    {
        return count(self::active($participants)) <= 1;
    }

    // ---- Sonuç uygulama ------------------------------------------------------

    /**
     * Tek maç sonucunu uygular (SAF). $realMatch=false => hükmen (no-show/çekilme) galibiyeti:
     * kazanana ilerleme galibiyeti + kaybedene bir mağlubiyet ama "gerçek maç" sayaçları/rakip
     * geçmişi ARTMAZ (contract §7, §9, §10).
     *
     * @return array<int,array<string,mixed>>
     */
    public static function applyResult(array $participants, int $winnerId, int $loserId, int $roundNo, bool $realMatch): array
    {
        foreach ($participants as &$p) {
            if ((int) $p['id'] === $winnerId) {
                $p['wins'] = (int) $p['wins'] + 1;
                if ($realMatch) {
                    $p['realWins'] = (int) $p['realWins'] + 1;
                    $p['opponents'] = array_values(array_unique(array_merge($p['opponents'], [$loserId])));
                }
            } elseif ((int) $p['id'] === $loserId) {
                $p['losses'] = (int) $p['losses'] + 1;
                if ($realMatch) {
                    $p['opponents'] = array_values(array_unique(array_merge($p['opponents'], [$winnerId])));
                }
                if ((int) $p['losses'] >= self::MAX_LIVES && ($p['status'] ?? 'active') === 'active') {
                    $p['status'] = 'eliminated';
                    $p['eliminatedRound'] = $roundNo;
                }
            }
        }
        unset($p);

        return $participants;
    }

    /** Çift mağlubiyet (iki taraf da gelmedi, kanıtlı): iki oyuncuya birer mağlubiyet, galip yok. */
    public static function applyDoubleLoss(array $participants, int $aId, int $bId, int $roundNo): array
    {
        foreach ([$aId, $bId] as $id) {
            foreach ($participants as &$p) {
                if ((int) $p['id'] === $id) {
                    $p['losses'] = (int) $p['losses'] + 1;
                    if ((int) $p['losses'] >= self::MAX_LIVES && ($p['status'] ?? 'active') === 'active') {
                        $p['status'] = 'eliminated';
                        $p['eliminatedRound'] = $roundNo;
                    }
                }
            }
            unset($p);
        }

        return $participants;
    }

    /** @return array<int,array<string,mixed>> */
    public static function applyBye(array $participants, int $byeId, int $roundNo): array
    {
        foreach ($participants as &$p) {
            if ((int) $p['id'] === $byeId) {
                $p['byes'] = (int) $p['byes'] + 1;
                $p['wins'] = (int) $p['wins'] + 1; // bay = ilerleme galibiyeti
                $p['byeRounds'] = array_values(array_merge($p['byeRounds'], [$roundNo]));
            }
        }
        unset($p);

        return $participants;
    }

    /**
     * Çekilme (contract §10). Aktif maç sonucu ayrıca kesinleşecekse burada mağlubiyet YAZMA
     * ($applyMatchLoss=false); yalnız durumu withdrawn yap. Eşleştirilmemiş/başlamamışsa sahte
     * mağlubiyet yaratma.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function applyWithdraw(array $participants, int $userId, int $roundNo, bool $applyMatchLoss): array
    {
        foreach ($participants as &$p) {
            if ((int) $p['id'] === $userId) {
                if ($applyMatchLoss) {
                    $p['losses'] = (int) $p['losses'] + 1;
                }
                $p['status'] = 'withdrawn';
                $p['withdrawnRound'] = $roundNo;
            }
        }
        unset($p);

        return $participants;
    }

    /** Diskalifiye: yapay 3 mağlubiyet YAZMA; ayrı durum (contract §3, §10). */
    public static function applyDisqualify(array $participants, int $userId, int $roundNo): array
    {
        foreach ($participants as &$p) {
            if ((int) $p['id'] === $userId) {
                $p['status'] = 'dq';
                $p['withdrawnRound'] = $roundNo;
            }
        }
        unset($p);

        return $participants;
    }

    // ---- Eşleştirme ----------------------------------------------------------

    /**
     * Bir sonraki tur eşleştirmesini üretir (SAF). Yalnız AKTİF oyunculardan.
     *
     * @return array{
     *   matches: array<int,array{0:int,1:int}>,   // [ [p1id, p2id], ... ]
     *   bye: int|null,
     *   deltas: array<int,int>,                    // id => +1/-1/0 (bu turda float yönü)
     *   optimal: bool,
     *   report: array<string,mixed>,               // ihlal/istatistik raporu
     *   complete: bool                             // <=1 aktif => turnuva bitti
     * }
     */
    public static function pairRound(array $participants, int $roundNo, string $seed): array
    {
        $active = self::active($participants);
        $byId = [];
        foreach ($active as $p) {
            $byId[(int) $p['id']] = $p;
        }

        if (count($active) <= 1) {
            return ['matches' => [], 'bye' => null, 'deltas' => [], 'optimal' => true, 'report' => [], 'complete' => true];
        }

        // Bay: tek sayıda aktif oyuncu varsa tam bir bay ver.
        $bye = null;
        $pool = $active;
        if (count($active) % 2 === 1) {
            $bye = self::selectBye($active);
            $pool = array_values(array_filter($active, fn ($p) => (int) $p['id'] !== $bye));
        }

        $matches = [];
        $optimal = true;
        if (count($pool) > 0) {
            if (count($pool) <= self::EXHAUSTIVE_MAX) {
                [$matches, $optimal] = self::exhaustiveMatch($pool);
            } else {
                $matches = self::heuristicMatch($pool);
                $optimal = false;
            }
        }

        $deltas = self::floatDeltas($matches, $byId);
        $report = self::pairingReport($matches, $byId, $optimal, $bye, $roundNo);

        return [
            'matches' => $matches,
            'bye' => $bye,
            'deltas' => $deltas,
            'optimal' => $optimal,
            'report' => $report,
            'complete' => false,
        ];
    }

    /**
     * Bay alacak oyuncuyu seç (contract §7):
     * 1) en az bay 2) en çok mağlubiyet 3) en az turnuva galibiyeti 4) bayı en eski turda almış 5) seed.
     */
    public static function selectBye(array $active): int
    {
        $cand = $active;
        usort($cand, function ($a, $b) {
            if (($a['byes'] ?? 0) !== ($b['byes'] ?? 0)) {
                return ($a['byes'] ?? 0) <=> ($b['byes'] ?? 0); // en az bay
            }
            if (($b['losses'] ?? 0) !== ($a['losses'] ?? 0)) {
                return ($b['losses'] ?? 0) <=> ($a['losses'] ?? 0); // en çok mağlubiyet
            }
            if (($a['wins'] ?? 0) !== ($b['wins'] ?? 0)) {
                return ($a['wins'] ?? 0) <=> ($b['wins'] ?? 0); // en az galibiyet
            }
            $ea = empty($a['byeRounds']) ? PHP_INT_MAX : min($a['byeRounds']);
            $eb = empty($b['byeRounds']) ? PHP_INT_MAX : min($b['byeRounds']);
            if ($ea !== $eb) {
                return $ea <=> $eb; // bayı en eski turda almış
            }

            return ($a['seed'] ?? 0) <=> ($b['seed'] ?? 0); // seed
        });

        return (int) $cand[0]['id'];
    }

    // ---- Eşleştirme maliyeti (lexicographic) --------------------------------

    /**
     * Bir maçın (a,b) maliyet katkısı. Lexicographic öncelik (contract §6):
     * 1) tekrar rakip 2) mağlubiyet farkı 3) galibiyet farkı 4) ardışık float 5) seed.
     * Max ve toplam ayrımı: c2max, c2sum, c3max, c3sum (önce max, sonra toplam).
     *
     * @return array{rematch:int,lossDiff:int,winDiff:int,badFloat:int}
     */
    private static function pairCost(array $a, array $b): array
    {
        $rematch = in_array((int) $b['id'], $a['opponents'] ?? [], true) ? 1 : 0;
        $lossDiff = abs((int) ($a['losses'] ?? 0) - (int) ($b['losses'] ?? 0));
        $winDiff = abs((int) ($a['wins'] ?? 0) - (int) ($b['wins'] ?? 0));

        // Ardışık float: mağlubiyet grubu farklıysa float var; float edilen oyuncunun geçen turki
        // yönü aynıysa cezalandır (art arda üst/alt gruba taşınmayı önle).
        $badFloat = 0;
        if ($lossDiff > 0) {
            // Daha AZ mağlubiyeti olan alt gruba (delta -1), daha ÇOK mağlubiyeti olan üst gruba (+1) taşınır.
            [$up, $down] = ((int) $a['losses'] > (int) $b['losses']) ? [$a, $b] : [$b, $a];
            if ((int) ($up['lastGroupDelta'] ?? 0) > 0) {
                $badFloat++;
            }
            if ((int) ($down['lastGroupDelta'] ?? 0) < 0) {
                $badFloat++;
            }
        }

        return ['rematch' => $rematch, 'lossDiff' => $lossDiff, 'winDiff' => $winDiff, 'badFloat' => $badFloat];
    }

    /**
     * Tüm eşleştirmenin lexicographic maliyet vektörü.
     * [ rematchCount, maxLossDiff, sumLossDiff, maxWinDiff, sumWinDiff, badFloatCount, seedSeq... ]
     * seedSeq: eşleştirmeyi benzersiz kılan kanonik seed-index dizisi (nihai tie-break).
     *
     * @param  array<int,array{0:array,1:array}>  $pairs
     * @return array<int,int>
     */
    private static function matchingCost(array $pairs): array
    {
        $rematch = 0;
        $maxLoss = 0;
        $sumLoss = 0;
        $maxWin = 0;
        $sumWin = 0;
        $badFloat = 0;
        $seedPairs = [];
        foreach ($pairs as [$a, $b]) {
            $c = self::pairCost($a, $b);
            $rematch += $c['rematch'];
            $sumLoss += $c['lossDiff'];
            $maxLoss = max($maxLoss, $c['lossDiff']);
            $sumWin += $c['winDiff'];
            $maxWin = max($maxWin, $c['winDiff']);
            $badFloat += $c['badFloat'];
            $lo = min((int) $a['seed'], (int) $b['seed']);
            $hi = max((int) $a['seed'], (int) $b['seed']);
            $seedPairs[] = [$lo, $hi];
        }
        usort($seedPairs, fn ($x, $y) => $x[0] <=> $y[0] ?: $x[1] <=> $y[1]);
        $seedSeq = [];
        foreach ($seedPairs as $sp) {
            $seedSeq[] = $sp[0];
            $seedSeq[] = $sp[1];
        }

        return array_merge([$rematch, $maxLoss, $sumLoss, $maxWin, $sumWin, $badFloat], $seedSeq);
    }

    /** Lexicographic karşılaştırma: a<b => -1. */
    private static function compareCost(array $a, array $b): int
    {
        $n = max(count($a), count($b));
        for ($i = 0; $i < $n; $i++) {
            $x = $a[$i] ?? 0;
            $y = $b[$i] ?? 0;
            if ($x !== $y) {
                return $x <=> $y;
            }
        }

        return 0;
    }

    /**
     * Küçük grup: tüm perfect matching'ler üzerinde global-optimal (lexicographic) seçim.
     * Değişmezler: kendisiyle oynamaz, her oyuncu tam bir kez, tam kapsama (recursion doğası gereği).
     *
     * @return array{0:array<int,array{0:int,1:int}>,1:bool} [matches(id çiftleri), optimal]
     */
    private static function exhaustiveMatch(array $pool): array
    {
        // seed'e göre kararlı sırala (deterministik gezinme)
        usort($pool, fn ($a, $b) => (int) $a['seed'] <=> (int) $b['seed']);
        $deadline = self::now() + self::PAIR_TIME_LIMIT;

        $best = null;
        $bestCost = null;
        $timedOut = false;

        $rec = function (array $remaining, array $acc) use (&$rec, &$best, &$bestCost, &$timedOut, $deadline): void {
            if ($timedOut) {
                return;
            }
            if (self::now() > $deadline) {
                $timedOut = true;

                return;
            }
            if (count($remaining) === 0) {
                $cost = self::matchingCost($acc);
                if ($bestCost === null || self::compareCost($cost, $bestCost) < 0) {
                    $bestCost = $cost;
                    $best = $acc;
                }

                return;
            }
            $first = array_shift($remaining);
            foreach ($remaining as $i => $cand) {
                $rest = $remaining;
                unset($rest[$i]);
                $rec(array_values($rest), array_merge($acc, [[$first, $cand]]));
            }
        };
        $rec($pool, []);

        if ($timedOut || $best === null) {
            return [self::heuristicMatch($pool), false];
        }

        $matches = [];
        foreach ($best as [$a, $b]) {
            $matches[] = [(int) $a['id'], (int) $b['id']];
        }

        return [$matches, true];
    }

    /**
     * Büyük grup sezgiseli: mağlubiyet grubuna göre (Swiss), grup içi (-wins, seed) sırala, ardışık
     * eşle, tek kalan alt gruba float. Sonra tekrar-rakip çiftlerini yerel takasla azalt. Değişmezler
     * korunur; optimal DEĞİL.
     *
     * @return array<int,array{0:int,1:int}>
     */
    private static function heuristicMatch(array $pool): array
    {
        // Grupları mağlubiyete göre sırala; grup içi (-wins, seed).
        usort($pool, function ($a, $b) {
            if ((int) $a['losses'] !== (int) $b['losses']) {
                return (int) $a['losses'] <=> (int) $b['losses'];
            }
            if ((int) $b['wins'] !== (int) $a['wins']) {
                return (int) $b['wins'] <=> (int) $a['wins'];
            }

            return (int) $a['seed'] <=> (int) $b['seed'];
        });

        $order = array_values($pool);
        $pairs = [];
        // Ardışık eşle (float doğal: tek kalan grup elemanı bir sonrakiyle eşleşir).
        for ($i = 0; $i + 1 < count($order); $i += 2) {
            $pairs[] = [$order[$i], $order[$i + 1]];
        }

        // Tekrar-rakip azalt: bir çift rematch ise, sonraki çiftle bir eleman takas etmeyi dene.
        $n = count($pairs);
        for ($i = 0; $i < $n; $i++) {
            [$a, $b] = $pairs[$i];
            if (! in_array((int) $b['id'], $a['opponents'] ?? [], true)) {
                continue;
            }
            for ($j = $i + 1; $j < $n; $j++) {
                [$c, $d] = $pairs[$j];
                // (a,d) ve (c,b) rematch değilse takas et
                $ad = in_array((int) $d['id'], $a['opponents'] ?? [], true);
                $cb = in_array((int) $b['id'], $c['opponents'] ?? [], true);
                if (! $ad && ! $cb && (int) $a['id'] !== (int) $d['id'] && (int) $c['id'] !== (int) $b['id']) {
                    $pairs[$i] = [$a, $d];
                    $pairs[$j] = [$c, $b];
                    break;
                }
            }
        }

        $matches = [];
        foreach ($pairs as [$a, $b]) {
            $matches[] = [(int) $a['id'], (int) $b['id']];
        }

        return $matches;
    }

    /** @param  array<int,array{0:int,1:int}>  $matches */
    private static function floatDeltas(array $matches, array $byId): array
    {
        $deltas = [];
        foreach ($matches as [$aId, $bId]) {
            $a = $byId[$aId] ?? null;
            $b = $byId[$bId] ?? null;
            if (! $a || ! $b) {
                continue;
            }
            $la = (int) $a['losses'];
            $lb = (int) $b['losses'];
            if ($la === $lb) {
                $deltas[$aId] = 0;
                $deltas[$bId] = 0;
            } elseif ($la > $lb) {
                $deltas[$aId] = 1;   // daha çok mağlubiyet -> üst gruba (rakibi az mağlubiyetli)
                $deltas[$bId] = -1;
            } else {
                $deltas[$aId] = -1;
                $deltas[$bId] = 1;
            }
        }

        return $deltas;
    }

    /** @param  array<int,array{0:int,1:int}>  $matches */
    private static function pairingReport(array $matches, array $byId, bool $optimal, ?int $bye, int $roundNo): array
    {
        $rematches = [];
        $maxLoss = 0;
        $maxWin = 0;
        foreach ($matches as [$aId, $bId]) {
            $a = $byId[$aId] ?? null;
            $b = $byId[$bId] ?? null;
            if (! $a || ! $b) {
                continue;
            }
            if (in_array($bId, $a['opponents'] ?? [], true)) {
                $rematches[] = [$aId, $bId];
            }
            $maxLoss = max($maxLoss, abs((int) $a['losses'] - (int) $b['losses']));
            $maxWin = max($maxWin, abs((int) $a['wins'] - (int) $b['wins']));
        }

        return [
            'round' => $roundNo,
            'algo_version' => self::ALGO_VERSION,
            'optimal' => $optimal,
            'pairs' => count($matches),
            'bye' => $bye,
            'rematches' => $rematches,
            'max_loss_diff' => $maxLoss,
            'max_win_diff' => $maxWin,
        ];
    }

    // ---- Sıralama ------------------------------------------------------------

    /** Canlı tablo (contract §12): aktif önce (az mağlubiyet, çok galibiyet, çok gerçek galibiyet). */
    public static function liveStandings(array $participants): array
    {
        $rows = $participants;
        usort($rows, function ($a, $b) {
            $sa = self::statusRank($a['status'] ?? 'active');
            $sb = self::statusRank($b['status'] ?? 'active');
            if ($sa !== $sb) {
                return $sa <=> $sb;
            }
            if ((int) $a['losses'] !== (int) $b['losses']) {
                return (int) $a['losses'] <=> (int) $b['losses'];
            }
            if ((int) $b['wins'] !== (int) $a['wins']) {
                return (int) $b['wins'] <=> (int) $a['wins'];
            }
            if ((int) $b['realWins'] !== (int) $a['realWins']) {
                return (int) $b['realWins'] <=> (int) $a['realWins'];
            }

            return (int) $a['seed'] <=> (int) $b['seed'];
        });

        return array_map(fn ($p) => [
            'id' => (int) $p['id'],
            'name' => $p['name'] ?? '',
            'status' => $p['status'] ?? 'active',
            'losses' => (int) $p['losses'],
            'wins' => (int) $p['wins'],
            'realWins' => (int) $p['realWins'],
            'byes' => (int) $p['byes'],
            'lives' => self::remainingLives($p),
        ], $rows);
    }

    private static function statusRank(string $status): int
    {
        return match ($status) {
            'active' => 0,
            'eliminated' => 1,
            'withdrawn' => 2,
            'dq' => 3,
            default => 4,
        };
    }

    /**
     * Kesin sonuç (contract §12): şampiyon 1; sonra elendikleri tur DAHA GEÇ olanlar önce; aynı turda
     * elenenler ORTAK derece (iki oyuncu ortak 3. ise sonraki 5.). Çekilen/DQ ayrı gösterilir (uydurma
     * derece yok). Hiç aktif yoksa şampiyon uydurma.
     *
     * @return array<int,array<string,mixed>> her satır: id,name,rank(int|null),status,losses,wins,realWins
     */
    public static function finalStandings(array $participants): array
    {
        $champ = self::championId($participants);
        $rows = [];

        // 1) Şampiyon
        if ($champ !== null) {
            $p = self::find($participants, $champ);
            $rows[] = self::standRow($p, 1);
        }

        // 2) Elenenler: eliminatedRound DESC; aynı tur ortak derece.
        $elim = array_values(array_filter($participants, fn ($p) => ($p['status'] ?? '') === 'eliminated'));
        usort($elim, fn ($a, $b) => (int) $b['eliminatedRound'] <=> (int) $a['eliminatedRound']
            ?: (int) $a['seed'] <=> (int) $b['seed']);
        $rank = $champ !== null ? 2 : 1;
        $i = 0;
        while ($i < count($elim)) {
            $round = (int) $elim[$i]['eliminatedRound'];
            $group = [];
            while ($i < count($elim) && (int) $elim[$i]['eliminatedRound'] === $round) {
                $group[] = $elim[$i];
                $i++;
            }
            foreach ($group as $g) {
                $rows[] = self::standRow($g, $rank); // aynı turda elenenler ORTAK derece
            }
            $rank += count($group); // sonraki derece grup boyutu kadar atlar
        }

        // 3) Çekilen/DQ: sportif derece YOK (rank null), durumuyla ayrı.
        foreach ($participants as $p) {
            $st = $p['status'] ?? 'active';
            if ($st === 'withdrawn' || $st === 'dq') {
                $rows[] = self::standRow($p, null);
            }
        }

        // 4) Aktif ama şampiyon değilse (turnuva bitmemiş çağrı) — rank null, sona.
        if ($champ === null) {
            foreach (self::active($participants) as $p) {
                $rows[] = self::standRow($p, null);
            }
        }

        return $rows;
    }

    private static function standRow(?array $p, ?int $rank): array
    {
        if (! $p) {
            return ['id' => 0, 'name' => '', 'rank' => $rank, 'status' => 'unknown', 'losses' => 0, 'wins' => 0, 'realWins' => 0];
        }

        return [
            'id' => (int) $p['id'],
            'name' => $p['name'] ?? '',
            'rank' => $rank,
            'status' => $p['status'] ?? 'active',
            'losses' => (int) $p['losses'],
            'wins' => (int) $p['wins'],
            'realWins' => (int) $p['realWins'],
        ];
    }

    public static function find(array $participants, int $id): ?array
    {
        foreach ($participants as $p) {
            if ((int) $p['id'] === $id) {
                return $p;
            }
        }

        return null;
    }

    // ---- Yardımcılar ---------------------------------------------------------

    /**
     * Deterministik seed'li karıştırma: her öğe hash(seed:key) ile sıralanır. Math.random/shuffle
     * KULLANMAZ (resume/tekrar-üretilebilirlik için).
     *
     * @param  callable(mixed):string  $keyOf
     */
    public static function seededShuffle(array $items, string $seed, callable $keyOf): array
    {
        $decorated = [];
        foreach ($items as $idx => $it) {
            $decorated[] = ['h' => hash('sha256', $seed.':'.$keyOf($it)), 'i' => $idx, 'v' => $it];
        }
        usort($decorated, fn ($a, $b) => strcmp($a['h'], $b['h']) ?: ($a['i'] <=> $b['i']));

        return array_map(fn ($d) => $d['v'], $decorated);
    }

    private static function now(): float
    {
        return microtime(true);
    }
}
