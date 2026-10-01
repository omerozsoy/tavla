<?php

namespace App\Support\Swiss;

use App\Models\Tournament;

/**
 * "3 Haklı Swiss" — saf SwissEngine ile Tournament kalıcı durumu (bracket + swiss_state) arasında
 * KÖPRÜ. Amaç: mevcut tek-eleme altyapısını (matchRoom/report/reconcileVerifiedResults/no-show/
 * frontend match render/bot playMatch) OLDUĞU GİBİ yeniden kullanmak.
 *
 * Depolama:
 *  - tournaments.bracket : tur dizisi; her tur, AYNI hücre şekliyle maç listesi
 *      {key,p1,p2,winner,score,room,target,minutes}. Bay = çözülü hücre (p2=null, winner=p1.id,
 *      score={bye:true}). Böylece reconcile/report/matchRoom/frontend gerçek maçlarda değişmeden çalışır.
 *  - tournaments.swiss_state : { version, algo, seed, round, participants[], config(KİLİTLİ), reports[], note }
 *
 * Turlar TAMAMLANDIKÇA bir sonraki tur ÜRETİLİR (Swiss). Sonuç uygulanınca (report/reconcile/no-show)
 * SwissEngine ile katılımcı hakları/galibiyet/eleme güncellenir; tur bitince yeni tur eklenir ya da
 * turnuva sonlandırılır. Çağıran ATOMİK (lockForUpdate) transaction sağlamalıdır.
 */
class SwissRuntime
{
    public const RULE_VERSION = 1;

    public static function isSwiss(Tournament $t): bool
    {
        return ($t->type ?? 'bracket') === 'swiss_triple';
    }

    /** Başlangıçta kural setini KİLİTLE (contract §4): süren turnuva yeni varsayılanlarla yorumlanmasın. */
    private static function lockedConfig(Tournament $t): array
    {
        return [
            'match_length' => max(1, (int) ($t->match_length ?: 1)),
            'final_length' => (int) ($t->final_length ?: 0) ?: null,
            'round_minutes' => (int) ($t->round_minutes ?: 0) ?: null,
            'final_minutes' => (int) ($t->final_minutes ?: 0) ?: null,
        ];
    }

    /**
     * Turnuvayı başlat (dondurulmuş katılımcı listesiyle). 1. tur kura + eşleştirme üretir. İki kez
     * çağrılsa bile (status kilidi çağıranda) tek ilk tur oluşur.
     */
    public static function start(Tournament $t): void
    {
        $players = array_values(array_filter($t->players ?? [], fn ($p) => $p !== null && ! empty($p['id'])));
        $seed = self::makeSeed($t);
        $participants = SwissEngine::initParticipants($players, $seed);

        $state = [
            'version' => self::RULE_VERSION,
            'algo' => SwissEngine::ALGO_VERSION,
            'seed' => $seed,
            'round' => 0,
            'participants' => $participants,
            'config' => self::lockedConfig($t),
            'reports' => [],
            'note' => null,
        ];

        $t->bracket = [];
        $t->swiss_state = $state;
        $t->status = 'running';
        $t->save();

        // İlk tur.
        self::generateRound($t);
        $t->save();
    }

    /**
     * Tek maç sonucunu uygular. $realMatch=false => hükmen (walkover/no-show). Tur tamamlanınca bir
     * sonraki tur üretilir veya turnuva sonlandırılır. Çağıran lockForUpdate transaction sağlar.
     */
    public static function applyResult(Tournament $t, int $ri, int $mi, int $winnerId, ?array $score, bool $realMatch): void
    {
        $bracket = is_array($t->bracket) ? $t->bracket : [];
        if (! isset($bracket[$ri][$mi]) || ! empty($bracket[$ri][$mi]['winner'])) {
            return; // zaten işlendi (idempotent)
        }
        $m = $bracket[$ri][$mi];
        $ids = [(int) ($m['p1']['id'] ?? 0), (int) ($m['p2']['id'] ?? 0)];
        if (! in_array($winnerId, $ids, true)) {
            return;
        }
        $loserId = $ids[0] === $winnerId ? $ids[1] : $ids[0];

        // 1) Hücreye yaz (UI + rev + tekrar-işleme kalkanı).
        $bracket[$ri][$mi]['winner'] = $winnerId;
        if ($score !== null) {
            $bracket[$ri][$mi]['score'] = $score;
        }
        $t->bracket = $bracket;

        // 2) Katılımcı durumunu güncelle (haklar/galibiyet/eleme).
        $state = $t->swiss_state;
        $round = (int) ($m['round'] ?? $state['round'] ?? ($ri + 1));
        $state['participants'] = SwissEngine::applyResult($state['participants'], $winnerId, $loserId, $round, $realMatch);
        $t->swiss_state = $state;

        // 3) Tur tamamlandıysa ilerlet / sonlandır.
        self::advanceIfRoundComplete($t, $ri);
        $t->save();
    }

    /** Bir turdaki TÜM maçlar (bay dahil) sonuçlandıysa sonraki turu üret ya da turnuvayı bitir. */
    private static function advanceIfRoundComplete(Tournament $t, int $ri): void
    {
        $bracket = is_array($t->bracket) ? $t->bracket : [];
        $round = $bracket[$ri] ?? [];
        foreach ($round as $m) {
            // Çözülü = galip belli VEYA çift mağlubiyet (yönetici düzeltmesi: galip yok ama maç bitti).
            if (empty($m['winner']) && empty($m['double_loss'])) {
                return; // bu tur henüz bitmedi
            }
        }

        $state = $t->swiss_state;
        if (SwissEngine::isComplete($state['participants'])) {
            self::finalize($t);

            return;
        }
        self::generateRound($t);
    }

    /** Sonraki turu (eşleştirme + bay) üretip bracket'e ekle; swiss_state'i güncelle. */
    private static function generateRound(Tournament $t): void
    {
        $state = $t->swiss_state;
        $bracket = is_array($t->bracket) ? $t->bracket : [];
        $roundNo = (int) $state['round'] + 1;
        $ri = count($bracket);
        $seed = (string) $state['seed'];

        $pr = SwissEngine::pairRound($state['participants'], $roundNo, $seed);
        if ($pr['complete']) {
            self::finalize($t);

            return;
        }

        // Son iki oyuncu (final) hedefi: yalnız AKTİF sayısı 2 iken final uzunluğu (contract §11).
        $activeCount = count(SwissEngine::active($state['participants']));
        $cfg = $state['config'];
        $isFinalTwo = $activeCount <= 2;
        $target = $isFinalTwo && ! empty($cfg['final_length']) ? (int) $cfg['final_length'] : (int) $cfg['match_length'];
        $minutes = $isFinalTwo && ! empty($cfg['final_minutes']) ? (int) $cfg['final_minutes'] : ($cfg['round_minutes'] ?? null);

        $byId = [];
        foreach ($state['participants'] as $p) {
            $byId[(int) $p['id']] = $p;
        }
        $playerCell = fn ($id) => $id ? [
            'id' => (int) $byId[$id]['id'],
            'name' => $byId[$id]['name'] ?? '',
            'rating' => (int) ($byId[$id]['rating'] ?? 0),
            'avatar' => $byId[$id]['avatar'] ?? null,
            'premium' => (bool) ($byId[$id]['premium'] ?? false),
        ] : null;

        $cells = [];
        $mi = 0;
        foreach ($pr['matches'] as [$aId, $bId]) {
            $cells[] = [
                'key' => "r{$ri}m{$mi}",
                'round' => $roundNo,
                'p1' => $playerCell($aId),
                'p2' => $playerCell($bId),
                'winner' => null,
                'target' => $target,
                'minutes' => $minutes,
                'room' => null,
                'final_two' => $isFinalTwo,
            ];
            $mi++;
        }
        // Bay: çözülü hücre (oda yok, hemen galibiyet). Katılımcıya bay uygula.
        if ($pr['bye'] !== null) {
            $byeId = (int) $pr['bye'];
            $state['participants'] = SwissEngine::applyBye($state['participants'], $byeId, $roundNo);
            // byId güncellensin (bay sonrası) — hücre için isim yeterli.
            $cells[] = [
                'key' => "r{$ri}m{$mi}",
                'round' => $roundNo,
                'p1' => $playerCell($byeId),
                'p2' => null,
                'winner' => $byeId,
                'score' => ['bye' => true],
                'bye' => true,
            ];
        }

        // Float yönlerini (bu tur) sonraki tur cezası için kaydet.
        $deltas = $pr['deltas'];
        foreach ($state['participants'] as &$p) {
            $p['lastGroupDelta'] = (int) ($deltas[(int) $p['id']] ?? 0);
        }
        unset($p);

        $bracket[] = $cells;
        $state['round'] = $roundNo;
        $state['reports'][] = $pr['report'];

        $t->bracket = $bracket;
        $t->swiss_state = $state;

        // Bay tek başına turu bitirebilir (aktif==1) — kontrol et.
        self::advanceIfRoundComplete($t, $ri);
    }

    /** Turnuvayı sonlandır: şampiyon (tek aktif) + ödüller; hiç aktif yoksa "şampiyon belirlenemedi". */
    private static function finalize(Tournament $t): void
    {
        if ($t->status === 'finished') {
            return;
        }
        $state = $t->swiss_state;
        $champ = SwissEngine::championId($state['participants']);
        $t->status = 'finished';
        if ($champ !== null) {
            $t->champion_id = $champ;
        } else {
            $state['note'] = 'no_champion'; // contract §10: hayali şampiyon YOK
            $t->swiss_state = $state;
        }
        if (! $t->prize_paid && $champ !== null) {
            self::payPrizes($t);
            $t->prize_paid = true;
        }
        $t->save();
    }

    /** Ödül dağıtımı — bracket payPrizes ile aynı politika ama Swiss kesin sıralamasıyla. */
    private static function payPrizes(Tournament $t): void
    {
        $standings = self::standings($t); // sıralı id'ler (şampiyon önce)
        if (empty($standings)) {
            return;
        }
        $prizes = is_array($t->prizes) ? $t->prizes : [];
        $pool = (int) ($t->prize_coins ?? 0);
        $wallet = app(\App\Services\WalletService::class);

        if (! empty($prizes)) {
            foreach ($prizes as $i => $pr) {
                $coins = (int) ($pr['coins'] ?? 0);
                if ($coins > 0 && isset($standings[$i])) {
                    $u = \App\Models\User::lockForUpdate()->find($standings[$i]);
                    if ($u) {
                        $wallet->credit($u, $coins, 'tournament_prize', Tournament::class, $t->id);
                    }
                }
            }
            if ($pool > 0) {
                $u = \App\Models\User::lockForUpdate()->find($standings[0]);
                if ($u) {
                    $wallet->credit($u, $pool, 'tournament_pool_prize', Tournament::class, $t->id);
                }
            }

            return;
        }
        if ($pool > 0) {
            $u = \App\Models\User::lockForUpdate()->find($standings[0]);
            if ($u) {
                $wallet->credit($u, $pool, 'tournament_pool_prize', Tournament::class, $t->id);
            }
        }
    }

    /** Kesin sıralama: dereceli (rank!=null) oyuncu id'leri, şampiyondan sona (ortak dereceler dahil). */
    public static function standings(Tournament $t): array
    {
        $state = $t->swiss_state;
        if (! is_array($state) || empty($state['participants'])) {
            return [];
        }
        $rows = SwissEngine::finalStandings($state['participants']);
        $ids = [];
        foreach ($rows as $r) {
            if ($r['rank'] !== null) {
                $ids[] = (int) $r['id'];
            }
        }

        return $ids;
    }

    /** Frontend için canlı Swiss durumu (detay payload'ına eklenir). */
    public static function serialize(Tournament $t): ?array
    {
        $state = $t->swiss_state;
        if (! is_array($state) || empty($state['participants'])) {
            return null;
        }
        $participants = $state['participants'];
        $lastReport = end($state['reports']) ?: null;

        return [
            'round' => (int) ($state['round'] ?? 0),
            'active' => count(SwissEngine::active($participants)),
            'total' => count($participants),
            'standings' => SwissEngine::liveStandings($participants),
            'final' => $t->status === 'finished' ? SwissEngine::finalStandings($participants) : null,
            'note' => $state['note'] ?? null,
            'config' => $state['config'] ?? null,
            'optimal_last' => $lastReport['optimal'] ?? true,
            'max_lives' => SwissEngine::MAX_LIVES,
        ];
    }

    /** Bir oyuncunun kalan hakkı (frontend/uyarı metinleri için hızlı erişim). */
    public static function livesOf(Tournament $t, int $userId): ?int
    {
        $state = $t->swiss_state;
        if (! is_array($state) || empty($state['participants'])) {
            return null;
        }
        $p = SwissEngine::find($state['participants'], $userId);

        return $p ? SwissEngine::remainingLives($p) : null;
    }

    /**
     * Turnuvadan ÇIK (çekilme veya diskalifiye), turnuva SÜRERKEN (contract §10).
     * $mode: 'withdraw' (kendi isteğiyle) | 'dq' (yönetici diskalifiye).
     *
     * Sıra: (1) katılımcı durumunu ÖNCE işaretle (withdrawn/dq) — böylece sonraki tur eşleştirmesi
     * onu almaz; (2) varsa BEKLEYEN maçını rakibe hükmen (walkover) bırak → applyResult turu ilerletir
     * / turnuvayı sonlandırır (rakip artık pasif olanı asla yeniden eşleşmez); (3) bekleyen maç yoksa
     * (bay almış / turlar arası) alan tek aktife düştüyse sonlandır. Sahte 3 mağlubiyet YOK: yalnız
     * gerçekten terk edilen maç bir walkover kaybı yazar (applyResult), o kadar. Çağıran lockForUpdate
     * transaction sağlar; idempotent (zaten pasifse walkover hücresi de çözülmüş olur → no-op).
     */
    public static function exit(Tournament $t, int $userId, string $mode): void
    {
        $state = $t->swiss_state;
        if (! is_array($state) || empty($state['participants'])) {
            return;
        }
        $round = (int) ($state['round'] ?? 0);
        $state['participants'] = $mode === 'dq'
            ? SwissEngine::applyDisqualify($state['participants'], $userId, $round)
            : SwissEngine::applyWithdraw($state['participants'], $userId, $round, false);
        $t->swiss_state = $state;

        // Bekleyen (kazananı belli olmayan) maçını bul → rakibe hükmen. Bay hücresi zaten çözülü
        // (winner=kendisi) olduğundan buraya düşmez.
        $bracket = is_array($t->bracket) ? $t->bracket : [];
        foreach ($bracket as $ri => $cells) {
            foreach ($cells as $mi => $m) {
                if (! empty($m['winner'])) {
                    continue;
                }
                $p1 = (int) ($m['p1']['id'] ?? 0);
                $p2 = (int) ($m['p2']['id'] ?? 0);
                if ($userId !== $p1 && $userId !== $p2) {
                    continue;
                }
                $opp = $userId === $p1 ? $p2 : $p1;
                if ($opp > 0) {
                    self::applyResult($t, $ri, $mi, $opp, ['walkover' => true], false); // kaydeder + ilerletir

                    return;
                }
                break 2; // rakipsiz bekleyen hücre (olmamalı) — sadece işaretle, tur bitince ilerler
            }
        }

        // Bekleyen maç yoktu → alan tek aktife düştüyse turnuvayı sonlandır.
        if (SwissEngine::isComplete($t->swiss_state['participants'])) {
            self::finalize($t); // kaydeder

            return;
        }
        $t->save();
    }

    /**
     * YÖNETİCİ SONUÇ DÜZELTME (contract §8): BEKLEYEN bir maçı hükmen çöz. $outcome: galip oyuncu id,
     * VEYA 0 = ÇİFT MAĞLUBİYET (iki taraf da gelmedi, kanıtlı → ikisine birer mağlubiyet, galip yok).
     * Zaten çözülmüş (winner/double_loss) maça veya bay hücresine DOKUNMAZ (false döner). Çözüm turu
     * tamamlarsa sonraki tur üretilir / turnuva sonlandırılır. NOT: uygulanmış sonucun GERİ ALINMASI
     * (sonraki turlar üretilmişken) kapsam DIŞI — yalnız bekleyen maç düzeltilir. Lock çağıranda.
     *
     * @return bool düzeltildi mi
     */
    public static function resolveMatch(Tournament $t, string $matchKey, int $outcome): bool
    {
        $bracket = is_array($t->bracket) ? $t->bracket : [];
        foreach ($bracket as $ri => $cells) {
            foreach ($cells as $mi => $m) {
                if (($m['key'] ?? null) !== $matchKey) {
                    continue;
                }
                if (! empty($m['winner']) || ! empty($m['double_loss'])) {
                    return false; // zaten çözülü
                }
                $p1 = (int) ($m['p1']['id'] ?? 0);
                $p2 = (int) ($m['p2']['id'] ?? 0);
                if ($p1 <= 0 || $p2 <= 0) {
                    return false; // bay / eksik — düzeltme yok
                }

                if ($outcome === 0) {
                    // Çift mağlubiyet: iki oyuncuya birer mağlubiyet, galip yok; hücre double_loss işaretli.
                    $state = $t->swiss_state;
                    $round = (int) ($m['round'] ?? $state['round'] ?? ($ri + 1));
                    $state['participants'] = SwissEngine::applyDoubleLoss($state['participants'], $p1, $p2, $round);
                    $t->swiss_state = $state;
                    $bracket[$ri][$mi]['double_loss'] = true;
                    $bracket[$ri][$mi]['score'] = ['double_loss' => true];
                    $t->bracket = $bracket;
                    self::advanceIfRoundComplete($t, $ri);
                    $t->save();

                    return true;
                }

                if ($outcome !== $p1 && $outcome !== $p2) {
                    return false; // galip bu maçta değil
                }
                // Hükmen galip (gerçek maç değil → realMatch=false, walkover gibi: realWin/rakip geçmişi yok).
                self::applyResult($t, $ri, $mi, $outcome, ['walkover' => true], false); // kaydeder + ilerletir

                return true;
            }
        }

        return false; // maç bulunamadı
    }

    private static function makeSeed(Tournament $t): string
    {
        // Deterministik ama tahmin edilemez: turnuva id + oluşturma zamanı + katılımcı id imzası.
        $sig = collect($t->players ?? [])->filter()->pluck('id')->sort()->implode(',');

        return hash('sha256', 'swiss:'.$t->id.':'.($t->created_at?->timestamp ?? 0).':'.$sig);
    }
}
