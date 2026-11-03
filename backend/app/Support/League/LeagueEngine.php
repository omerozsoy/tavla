<?php

namespace App\Support\League;

/**
 * Türkiye Online Tavla Ligi — LİG AŞAMASI eşleştirme + sıralama motoru (SAF / stateless).
 *
 * DB'ye dokunmaz; yalnız katılımcı dizileri üzerinde çalışır. Deterministiktir: aynı girdi + aynı seed
 * => aynı eşleştirme. Eleme ağacı (§7) ayrı (LeagueBracket); bu sınıf yalnız 8 turluk İsviçre-benzeri
 * lig aşamasını yönetir.
 *
 * LİG PUANI (§5): Galibiyet/hükmen-galibiyet/bay = +1. Mağlubiyet/hükmen-mağlubiyet/çift-gelmeme = 0.
 * (points = wins + byes; mağlubiyet puanı değiştirmez.)
 *
 * SIRALAMA ÖLÇÜTLERİ (§5, bu sırayla):
 *   1) lig puanı (DESC)
 *   2) karşılaşılan rakiplerin toplam lig puanı (DESC)   — Buchholz
 *   3) yenilen rakiplerin toplam lig puanı (DESC)         — yalnız galip gelinen rakipler
 *   4) güncel TavlaTV rating (DESC)                        — hesap anındaki değer (çağıran verir)
 *   5) adminin belirlediği sıra                            — tiebreak_manual
 *   (hiçbiri ayırmazsa seed yalnız DETERMİNİSTİK GÖSTERİM içindir; kritik sınır eşitlikleri ayrıca
 *    raporlanır ki admin çözmeden lig aşaması kesinleştirilemesin — gizli kura YOK.)
 *
 * BAY / HÜKMEN / ÇEKİLME'NİN RAKİP-PUANI ETKİSİ (§5 — ürün kararı, sahte oyuncu YOK):
 *   - Bay bir rakip DEĞİLDİR: opponents/beaten listesine girmez, 2. ve 3. ölçütlere katkısı YOKTUR;
 *     yalnız bay alan oyuncuya +1 lig puanı verir (1. ölçüt).
 *   - Hükmen (no-show) maç İKİ GERÇEK oyuncu arasındadır: her iki taraf birbirinin "karşılaşılan
 *     rakibi"dir (2. ölçüt). Hükmen GALİP, hükmen mağlup olanı "yenilen rakip" sayar (3. ölçüt);
 *     hükmen mağlup kimseyi yenmez.
 *   - Çift-gelmeme: iki gerçek oyuncu birbirinin rakibidir (2. ölçüt), kimse kimseyi yenmez (3. ölçüt).
 *   - Çekilen oyuncu sıralamada KALIR (biriktirdiği puanla); onunla oynamış rakiplerin 2./3. ölçüt
 *     toplamına katkısı korunur (çekilme anındaki puanı). Eleme için aktif sayılmaz (LeagueBracket).
 *
 * EŞLEŞTİRME (§6): İlk tur rastgele kura. Sonraki turlar benzer puanlıları eşler, aynı iki oyuncu lig
 * aşamasında TEKRAR eşleşmez (HARD kısıt). Basit sıralı-eşle-çıkmaza-gir DEĞİL: geri-izlemeli (backtracking)
 * arama tüm tur için tekrar-rakipsiz geçerli eşleşme bulur, gerektiğinde geçici seçimleri geri alır;
 * puan farkını küçük tutmak için adaylar puan-farkına göre denenir. Matematiksel olarak geçerli eşleşme
 * yoksa gizlice tekrar-rakip serbest bırakmaz -> ok=false,reason=no_valid_pairing (admin müdahalesi, §6).
 *
 * ponytail: greedy-maliyetli backtracking (kanıtlı-global-min-cost perfect-matching DEĞİL; tekrar-rakip
 * HARD + puan farkı greedy). Puan farkı dağılımı patolojik olursa min-cost blossom'a yükseltilebilir.
 */
class LeagueEngine
{
    public const ALGO_VERSION = 1;

    /** Backtracking düğüm bütçesi; aşılırsa eşleşme bulunamadı sayılır (admin müdahalesi). */
    public const PAIR_STEP_BUDGET = 500000;

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
                'seed' => $i,          // lig başında kilitlenen kura sırası (nihai deterministik gösterim)
                'points' => 0,         // lig puanı = wins + byes
                'wins' => 0,           // galibiyet (hükmen dahil)
                'losses' => 0,         // mağlubiyet (hükmen + çift-gelmeme dahil)
                'byes' => 0,
                'byeRounds' => [],
                'opponents' => [],     // karşılaşılan gerçek rakip id'leri (hükmen/çift-gelmeme dahil, bay HARİÇ)
                'beaten' => [],        // yenilen rakip id'leri (hükmen galibiyet dahil)
                'withdrawnRound' => null,
                'status' => 'active',  // active | withdrawn
            ];
        }

        return $out;
    }

    /** @return array<int,array<string,mixed>> */
    public static function active(array $participants): array
    {
        return array_values(array_filter($participants, fn ($p) => ($p['status'] ?? 'active') === 'active'));
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

    // ---- Sonuç uygulama (SAF) ------------------------------------------------

    /**
     * Galibiyet (oynanmış VEYA hükmen). Lig puanı açısından ikisi aynı: kazanan +1 puan, rakip
     * "karşılaşılan + yenilen" sayılır. (Oynanmış↔hükmen farkı RATING'e aittir; motor rating bilmez.)
     *
     * @return array<int,array<string,mixed>>
     */
    public static function applyMatch(array $participants, int $winnerId, int $loserId): array
    {
        foreach ($participants as &$p) {
            $id = (int) $p['id'];
            if ($id === $winnerId) {
                $p['points'] = (int) $p['points'] + 1;
                $p['wins'] = (int) $p['wins'] + 1;
                $p['opponents'] = self::addUnique($p['opponents'], $loserId);
                $p['beaten'] = self::addUnique($p['beaten'], $loserId);
            } elseif ($id === $loserId) {
                $p['losses'] = (int) $p['losses'] + 1;
                $p['opponents'] = self::addUnique($p['opponents'], $winnerId);
            }
        }
        unset($p);

        return $participants;
    }

    /** Çift-gelmeme: iki taraf da 0 puan, birbirinin rakibi; kimse kimseyi yenmez (§5, §9). */
    public static function applyDoubleNoShow(array $participants, int $aId, int $bId): array
    {
        foreach ($participants as &$p) {
            $id = (int) $p['id'];
            if ($id === $aId) {
                $p['losses'] = (int) $p['losses'] + 1;
                $p['opponents'] = self::addUnique($p['opponents'], $bId);
            } elseif ($id === $bId) {
                $p['losses'] = (int) $p['losses'] + 1;
                $p['opponents'] = self::addUnique($p['opponents'], $aId);
            }
        }
        unset($p);

        return $participants;
    }

    /** Bay: +1 lig puanı, rakip DEĞİL (opponents'a eklenmez). */
    public static function applyBye(array $participants, int $byeId, int $roundNo): array
    {
        foreach ($participants as &$p) {
            if ((int) $p['id'] === $byeId) {
                $p['points'] = (int) $p['points'] + 1;
                $p['byes'] = (int) $p['byes'] + 1;
                $p['byeRounds'] = array_values(array_merge($p['byeRounds'], [$roundNo]));
            }
        }
        unset($p);

        return $participants;
    }

    /** Çekilme (§10): durum withdrawn; biriktirdiği puan KORUNUR (sahte mağlubiyet yazılmaz). */
    public static function applyWithdraw(array $participants, int $userId, int $roundNo): array
    {
        foreach ($participants as &$p) {
            if ((int) $p['id'] === $userId) {
                $p['status'] = 'withdrawn';
                $p['withdrawnRound'] = $roundNo;
            }
        }
        unset($p);

        return $participants;
    }

    // ---- Eşleştirme ----------------------------------------------------------

    /**
     * Bir sonraki tur eşleştirmesini üretir (SAF, yalnız AKTİF oyunculardan).
     *
     * @return array{
     *   ok:bool, reason?:string,
     *   matches: array<int,array{0:int,1:int}>,
     *   bye: int|null,
     *   complete: bool,
     *   report: array<string,mixed>
     * }
     */
    public static function pairRound(array $participants, int $roundNo, string $seed, bool $firstRandom = false): array
    {
        $activeList = self::active($participants);
        if (count($activeList) <= 1) {
            return ['ok' => true, 'matches' => [], 'bye' => null, 'complete' => true, 'report' => ['round' => $roundNo, 'pairs' => 0]];
        }

        $bye = null;
        $pool = $activeList;
        if (count($activeList) % 2 === 1) {
            $bye = self::selectBye($activeList);
            $pool = array_values(array_filter($activeList, fn ($p) => (int) $p['id'] !== $bye));
        }

        if ($firstRandom) {
            $sh = self::seededShuffle($pool, $seed.':r'.$roundNo, fn ($p) => (string) $p['id']);
            $matches = [];
            for ($i = 0; $i + 1 < count($sh); $i += 2) {
                $matches[] = [(int) $sh[$i]['id'], (int) $sh[$i + 1]['id']];
            }

            return ['ok' => true, 'matches' => $matches, 'bye' => $bye, 'complete' => false, 'report' => self::report($matches, $participants, $roundNo, $bye)];
        }

        $matches = self::backtrackPair($pool);
        if ($matches === null) {
            return [
                'ok' => false, 'reason' => 'no_valid_pairing', 'matches' => [], 'bye' => $bye, 'complete' => false,
                'report' => ['round' => $roundNo, 'note' => 'tekrar-rakipsiz geçerli eşleşme bulunamadı'],
            ];
        }

        return ['ok' => true, 'matches' => $matches, 'bye' => $bye, 'complete' => false, 'report' => self::report($matches, $participants, $roundNo, $bye)];
    }

    /**
     * Bay alacak oyuncuyu seç (§6/§7 — tutarlı ve kaydedilen yöntem):
     * 1) en az bay almış 2) en düşük lig puanı (standart Swiss: bay en alt gruba) 3) seed (deterministik).
     */
    public static function selectBye(array $active): int
    {
        $c = $active;
        usort($c, function ($a, $b) {
            if ((int) ($a['byes'] ?? 0) !== (int) ($b['byes'] ?? 0)) {
                return (int) ($a['byes'] ?? 0) <=> (int) ($b['byes'] ?? 0);   // en az bay
            }
            if ((int) ($a['points'] ?? 0) !== (int) ($b['points'] ?? 0)) {
                return (int) ($a['points'] ?? 0) <=> (int) ($b['points'] ?? 0); // en düşük puan
            }

            return (int) ($a['seed'] ?? 0) <=> (int) ($b['seed'] ?? 0);
        });

        return (int) $c[0]['id'];
    }

    /**
     * Geri-izlemeli (backtracking) eşleştirme: tekrar-rakip HARD kısıt. İlk eşleşmemiş oyuncu için
     * adaylar puan-farkına (sonra seed) göre denenir; tamamlanamayan dal geri alınır. Tekrar-rakipsiz
     * tam eşleşme VARSA kesin bulur (sıralı-greedy'nin çıkmaza girme kusuru yok). Yoksa null.
     *
     * @return array<int,array{0:int,1:int}>|null
     */
    private static function backtrackPair(array $pool): ?array
    {
        usort($pool, fn ($a, $b) => (int) $b['points'] <=> (int) $a['points'] ?: (int) $a['seed'] <=> (int) $b['seed']);
        $n = count($pool);
        if ($n === 0) {
            return [];
        }
        if ($n % 2 !== 0) {
            return null; // güvenlik: havuz çift olmalı (bay dışarıda ayrıldı)
        }

        $used = array_fill(0, $n, false);
        $steps = 0;

        $rec = function () use (&$rec, &$pool, &$used, &$steps, $n): ?array {
            if (++$steps > self::PAIR_STEP_BUDGET) {
                return null;
            }
            $i = -1;
            for ($k = 0; $k < $n; $k++) {
                if (! $used[$k]) {
                    $i = $k;
                    break;
                }
            }
            if ($i === -1) {
                return []; // hepsi eşleşti
            }
            $used[$i] = true;

            $cands = [];
            for ($j = $i + 1; $j < $n; $j++) {
                if ($used[$j]) {
                    continue;
                }
                if (in_array((int) $pool[$j]['id'], $pool[$i]['opponents'] ?? [], true)) {
                    continue; // tekrar-rakip HARD -> aday değil
                }
                $cands[] = $j;
            }
            usort($cands, function ($x, $y) use (&$pool, $i) {
                $dx = abs((int) $pool[$i]['points'] - (int) $pool[$x]['points']);
                $dy = abs((int) $pool[$i]['points'] - (int) $pool[$y]['points']);

                return $dx <=> $dy ?: (int) $pool[$x]['seed'] <=> (int) $pool[$y]['seed'];
            });

            foreach ($cands as $j) {
                $used[$j] = true;
                $sub = $rec();
                if ($sub !== null) {
                    return array_merge([[(int) $pool[$i]['id'], (int) $pool[$j]['id']]], $sub);
                }
                $used[$j] = false;
            }
            $used[$i] = false;

            return null;
        };

        return $rec();
    }

    private static function report(array $matches, array $participants, int $roundNo, ?int $bye): array
    {
        $by = [];
        foreach ($participants as $p) {
            $by[(int) $p['id']] = $p;
        }
        $rematches = 0;
        $maxDiff = 0;
        foreach ($matches as [$a, $b]) {
            $pa = $by[$a] ?? null;
            $pb = $by[$b] ?? null;
            if (! $pa || ! $pb) {
                continue;
            }
            if (in_array($b, $pa['opponents'] ?? [], true)) {
                $rematches++;
            }
            $maxDiff = max($maxDiff, abs((int) $pa['points'] - (int) $pb['points']));
        }

        return [
            'round' => $roundNo,
            'algo_version' => self::ALGO_VERSION,
            'pairs' => count($matches),
            'bye' => $bye,
            'rematches' => $rematches,
            'max_point_diff' => $maxDiff,
        ];
    }

    // ---- Sıralama ------------------------------------------------------------

    /**
     * Lig sıralaması (§5). $adminOrder: { userId => order } (düşük=üst). Çekilenler de puanlarıyla
     * sıralanır (§10 görünür kalır); eleme uygunluğu status'e göre LeagueBracket'te süzülür.
     *
     * @return array<int,array<string,mixed>> her satır rank (1..n) + tüm ölçüt değerleriyle
     */
    public static function standings(array $participants, array $adminOrder = []): array
    {
        $pts = [];
        foreach ($participants as $p) {
            $pts[(int) $p['id']] = (int) $p['points'];
        }

        $rows = [];
        foreach ($participants as $p) {
            $oppPoints = 0;
            foreach ($p['opponents'] ?? [] as $oid) {
                $oppPoints += $pts[$oid] ?? 0;
            }
            $beatenPoints = 0;
            foreach ($p['beaten'] ?? [] as $oid) {
                $beatenPoints += $pts[$oid] ?? 0;
            }
            $rows[] = [
                'id' => (int) $p['id'],
                'name' => $p['name'] ?? '',
                'status' => $p['status'] ?? 'active',
                'points' => (int) $p['points'],
                'wins' => (int) $p['wins'],
                'losses' => (int) $p['losses'],
                'byes' => (int) $p['byes'],
                'oppPoints' => $oppPoints,     // 2. ölçüt
                'beatenPoints' => $beatenPoints, // 3. ölçüt
                'rating' => (int) ($p['rating'] ?? 0), // 4. ölçüt (çağıran güncel değeri initParticipants/update ile verir)
                'adminOrder' => $adminOrder[(int) $p['id']] ?? null, // 5. ölçüt
                'seed' => (int) $p['seed'],    // yalnız deterministik gösterim
            ];
        }

        usort($rows, fn ($a, $b) => self::cmpStanding($a, $b));
        $rank = 1;
        foreach ($rows as &$r) {
            $r['rank'] = $rank++;
        }
        unset($r);

        return $rows;
    }

    private static function cmpStanding(array $a, array $b): int
    {
        if ($a['points'] !== $b['points']) {
            return $b['points'] <=> $a['points'];
        }
        if ($a['oppPoints'] !== $b['oppPoints']) {
            return $b['oppPoints'] <=> $a['oppPoints'];
        }
        if ($a['beatenPoints'] !== $b['beatenPoints']) {
            return $b['beatenPoints'] <=> $a['beatenPoints'];
        }
        if ($a['rating'] !== $b['rating']) {
            return $b['rating'] <=> $a['rating'];
        }
        $ao = $a['adminOrder'] ?? PHP_INT_MAX;
        $bo = $b['adminOrder'] ?? PHP_INT_MAX;
        if ($ao !== $bo) {
            return $ao <=> $bo; // düşük order üstte
        }

        return $a['seed'] <=> $b['seed']; // yalnız gösterim; kritik eşitlikler unresolvedCriticalTies ile raporlanır
    }

    /**
     * Elemeye giriş sınırlarında (ilk 8 | 9-24 ayrımları: pozisyon 8/9 ve 24/25) ölçüt 1-4 ile
     * ÇÖZÜLEMEYEN ve admin sırası da verilmemiş eşitlikler (§5 "kritik sıralamalar çözülmeden kesin
     * onay engellenir"). Yalnız AKTİF oyuncular eleme sıralamasına girer.
     *
     * @return array<int,array{boundary:int,ids:array<int,int>}>
     */
    public static function unresolvedCriticalTies(array $participants, array $adminOrder = []): array
    {
        $rows = self::standings($participants, $adminOrder);
        $activeRows = array_values(array_filter($rows, fn ($r) => $r['status'] === 'active'));
        $ties = [];
        foreach ([8, 24] as $bpos) { // bpos'tan SONRAKİ sınır: (8|9), (24|25)
            if (count($activeRows) <= $bpos) {
                continue;
            }
            $hi = $activeRows[$bpos - 1];
            $lo = $activeRows[$bpos];
            if (self::eqCriteria($hi, $lo) && ($hi['adminOrder'] ?? null) === null && ($lo['adminOrder'] ?? null) === null) {
                $group = array_values(array_filter($activeRows, fn ($r) => self::eqCriteria($r, $hi)));
                $ties[] = ['boundary' => $bpos, 'ids' => array_map(fn ($r) => (int) $r['id'], $group)];
            }
        }

        return $ties;
    }

    private static function eqCriteria(array $a, array $b): bool
    {
        return $a['points'] === $b['points']
            && $a['oppPoints'] === $b['oppPoints']
            && $a['beatenPoints'] === $b['beatenPoints']
            && $a['rating'] === $b['rating'];
    }

    // ---- Yardımcılar ---------------------------------------------------------

    private static function addUnique(array $arr, int $id): array
    {
        return in_array($id, $arr, true) ? $arr : array_values(array_merge($arr, [$id]));
    }

    /**
     * Deterministik seed'li karıştırma (SwissEngine ile aynı yöntem): her öğe hash(seed:key) ile sıralanır.
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
}
