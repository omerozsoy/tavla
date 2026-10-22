<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Motor-yardımı (engine-assist) HİLE DEDEKTÖRÜ — SİNYAL'dir, KANIT değil.
 *
 * Kaynak: match_results.gnubg_pr + pr_decisions (zaten her maç için hesaplanıyor; kalıcı tablo,
 * shield_presence gibi prune OLMAZ → geçmiş kaybolmaz). Shield.php HTTP suistimalini izler;
 * bu sınıf OYUN KALİTESİNİ izler — ikisi ayrı katman.
 *
 * İki sinyal (bkz. güvenlik incelemesi 2026-10-22):
 *  1) Mutlak: uzun örneklemde (pr_decisions ≥ MIN_DECISIONS) PR < PR_ABSOLUTE = motor-seviyesi.
 *     İnsan 100+ kararda sub-3 PR tutamaz; dünya elitinin bile üstü.
 *  2) Bimodal: maç PR'ı, oyuncunun KENDİ medyanının çok altında (< medyan × BIMODAL_RATIO).
 *     "Bazı maçta motor açık, bazısında kapalı" imzası — medyanı iyi (örn. 7) olan biri
 *     bir maçta 0.8 oynayınca yakalanır. Tutarlı insan kendi seviyesi etrafında kümelenir.
 *
 * Eşikler TUNABLE — gerçek veriye karşı kalibre et (`security:cheat-scan` raporuyla).
 */
class CheatScan
{
    // Eşikler canlı veriye kalibre edildi (2026-10-22): PR<3/25-karar SİTENİN %24'ünü işaretliyordu —
    // çünkü normal 5p maç (~40-59 karar) çoğu zorlama hamle, PR doğal olarak düşük (baz oran: maçların
    // %10'u zaten PR<3). Uzun örneklem (≥60 karar) + sıkı PR + TEKRAR şartı gerçek sinyali ayırır.
    // ponytail: tek-maç PR'ından kesin hile çıkmaz (güçlü oyuncu kolay maçta sub-2 atar); bu TRİYAJ —
    // kesin kanıt hamle-hamle motor eşleşmesi. Eşiği yükseltmek = daha az yanlış pozitif.

    /** Örneklem PR'ın beceriye yakınsaması için gereken en az karar sayısı. */
    public const MIN_DECISIONS = 60;

    /** Bu PR'ın altı, uzun örneklemde motor-seviyesi (XG dünya eliti ~2.5-4.5). */
    public const PR_ABSOLUTE = 2.0;

    /** DÜNYA ŞAMPİYONU / XG elit TABANI — grafik referans çizgisi. Dünya eliti uzun örneklemde
     *  ~2.5-4.5 PR ortalar; bu çizginin ALTINA düzenli inmek insani değildir (motor sinyali). */
    public const PR_WORLD_CHAMPION = 2.5;

    /** Maç PR'ı, oyuncunun kendi medyanının bu oranından düşükse bimodal-şüpheli. */
    public const BIMODAL_RATIO = 0.40;

    /** Bimodal sinyali için oyuncunun en az bu kadar puanlı (PR'lı) maçı olmalı (medyan güvenilir olsun). */
    public const MIN_MEDIAN_SAMPLE = 8;

    /** Bimodal maç yine de bu tavanın altında olmalı (iyi-ama-normal maçı bimodal sanmamak için). */
    public const BIMODAL_PR_CEILING = 3.0;

    /** Panel rozeti / otomatik işaretleme için hesap en az bu kadar şüpheli maça sahip olmalı (tek maç = varyans). */
    public const SUSPECT_MIN_FLAGS = 2;

    /** suspectIds() cache süresi (sn). Günlük security:cheat-scan tazeler; panel ucuz okur. */
    private const CACHE_TTL = 3600;

    /**
     * Şüpheli maçları döndürür (tüm site ya da tek kullanıcı). Read-only.
     *
     * @return array<int,array{user_id:int,room_code:?string,pr:float,checker_pr:float,decisions:int,cube_decisions:int,match_length:?int,opponent_name:?string,opponent_user_id:?int,opponent_pr:float,won:bool,created_at:?string,median:float,reason:string}>
     */
    public static function flaggedMatches(?int $userId = null): array
    {
        if (! Schema::hasTable('match_results')) {
            return [];
        }

        $rows = self::load($userId);
        $medians = self::mediansByUser($rows);

        $flagged = [];
        foreach ($rows as $r) {
            $dec = (int) ($r->pr_decisions ?? 0);
            $pr = (float) $r->gnubg_pr;
            if ($dec < self::MIN_DECISIONS || $pr <= 0) {
                continue; // kısa/gürültülü ya da analiz edilmemiş maç — eleme
            }

            $median = $medians[$r->user_id] ?? 0.0;
            $absolute = $pr < self::PR_ABSOLUTE;
            $bimodal = $median > 0
                && ($medians['__n__'][$r->user_id] ?? 0) >= self::MIN_MEDIAN_SAMPLE
                && $pr < $median * self::BIMODAL_RATIO
                && $pr < self::BIMODAL_PR_CEILING;

            if (! $absolute && ! $bimodal) {
                continue;
            }

            $flagged[] = [
                'user_id' => (int) $r->user_id,
                'room_code' => $r->room_code,
                'pr' => round($pr, 2),
                'checker_pr' => round((float) ($r->gnubg_checker_pr ?? 0), 2),
                'decisions' => $dec,
                'cube_decisions' => (int) ($r->cube_decisions ?? 0),
                'match_length' => $r->match_length !== null ? (int) $r->match_length : null,
                'opponent_name' => $r->opponent_name,
                'opponent_user_id' => $r->opponent_user_id !== null ? (int) $r->opponent_user_id : null,
                'opponent_pr' => round((float) ($r->opponent_pr ?? 0), 1),
                'won' => (bool) $r->won,
                'created_at' => $r->created_at,
                'median' => round($median, 1),
                'reason' => $absolute && $bimodal ? 'mutlak+bimodal' : ($absolute ? 'mutlak' : 'bimodal'),
            ];
        }

        // En düşük PR (en ağır) üstte
        usort($flagged, fn ($a, $b) => $a['pr'] <=> $b['pr']);

        return $flagged;
    }

    /**
     * Şüpheli kullanıcıları (≥1 flag) özetler: medyan PR, flag sayısı, en kötü (en düşük) PR.
     * En çok flag + en düşük PR üstte.
     *
     * @return array<int,array{user_id:int,nickname:string,rating:?int,banned:bool,created_at:?string,median:float,flags:int,worst_pr:float}>
     */
    public static function suspects(int $minFlags = self::SUSPECT_MIN_FLAGS, int $limit = 200): array
    {
        $flagged = self::flaggedMatches();
        if ($flagged === []) {
            return [];
        }

        $byUser = [];
        foreach ($flagged as $f) {
            $uid = $f['user_id'];
            $byUser[$uid]['flags'] = ($byUser[$uid]['flags'] ?? 0) + 1;
            $byUser[$uid]['worst_pr'] = min($byUser[$uid]['worst_pr'] ?? INF, $f['pr']);
            $byUser[$uid]['median'] = $f['median'];
        }
        $byUser = array_filter($byUser, fn ($a) => $a['flags'] >= max(1, $minFlags));

        $users = DB::table('users')->whereIn('id', array_keys($byUser))
            ->get(['id', 'nickname', 'first_name', 'rating', 'banned_at', 'created_at'])->keyBy('id');

        $out = [];
        foreach ($byUser as $uid => $agg) {
            $u = $users[$uid] ?? null;
            $out[] = [
                'user_id' => (int) $uid,
                'nickname' => $u?->nickname ?: ($u?->first_name ?: ('#'.$uid)),
                'rating' => $u?->rating !== null ? (int) $u->rating : null,
                'banned' => (bool) ($u?->banned_at),
                'created_at' => $u?->created_at,
                'median' => (float) $agg['median'],
                'flags' => (int) $agg['flags'],
                'worst_pr' => (float) $agg['worst_pr'],
            ];
        }

        usort($out, fn ($a, $b) => [$b['flags'], -$a['worst_pr']] <=> [$a['flags'], -$b['worst_pr']]);

        return array_slice($out, 0, $limit);
    }

    /**
     * TEK KULLANICI grafik+izah profili: büyük-örneklemli (≥MIN_DECISIONS karar) TÜM maçlarının PR
     * serisi + istatistik + verdict. Panel bununla kullanıcı-bazlı dağılım grafiği (motor/dünya-şampiyonu/
     * medyan referans çizgileri) + neden anlatısı çizer.
     *
     * @return array{n:int,median:float,mean:float,std:float,min:float,max:float,below_wc:int,below_engine:int,
     *               verdict:string,reason:string,points:array<int,array{pr:float,decisions:int,won:bool,
     *               match_length:?int,room_code:?string,created_at:?string,zone:string}>}
     */
    public static function profile(int $userId): array
    {
        $rows = self::load($userId);
        $pts = [];
        foreach ($rows as $r) {
            $dec = (int) ($r->pr_decisions ?? 0);
            $pr = (float) $r->gnubg_pr;
            if ($dec < self::MIN_DECISIONS || $pr <= 0) {
                continue; // yalnız anlamlı örneklem (kısa maç gürültüsü grafiği bozmasın)
            }
            $zone = $pr < self::PR_ABSOLUTE ? 'engine' : ($pr < self::PR_WORLD_CHAMPION ? 'champ' : 'human');
            $pts[] = [
                'pr' => round($pr, 2), 'decisions' => $dec, 'won' => (bool) $r->won,
                'match_length' => $r->match_length !== null ? (int) $r->match_length : null,
                'room_code' => $r->room_code, 'created_at' => $r->created_at, 'zone' => $zone,
            ];
        }
        usort($pts, fn ($a, $b) => $a['pr'] <=> $b['pr']);

        $prs = array_column($pts, 'pr');
        $n = count($prs);
        $mean = $n ? array_sum($prs) / $n : 0.0;
        $sorted = $prs;
        sort($sorted);
        $median = $n ? $sorted[intdiv($n, 2)] : 0.0;
        $std = 0.0;
        if ($n > 1) {
            foreach ($prs as $p) {
                $std += ($p - $mean) ** 2;
            }
            $std = sqrt($std / $n);
        }
        $belowWc = count(array_filter($prs, fn ($p) => $p < self::PR_WORLD_CHAMPION));
        $belowEngine = count(array_filter($prs, fn ($p) => $p < self::PR_ABSOLUTE));

        // VERDICT: medyan dünya-şampiyonu seviyesinin altındaysa -> TÜM oyun elit = SÜREKLİ motor.
        // Medyan normal ama birden çok maç çizginin çok altındaysa -> SEÇİCİ (bazı maçta motor açık).
        if ($n >= self::MIN_MEDIAN_SAMPLE && $median < self::PR_WORLD_CHAMPION) {
            $verdict = 'consistent';
            $reason = 'SÜREKLİ motor şüphesi: medyan PR '.round($median, 1).' — oyuncu ~TÜM maçlarında dünya-şampiyonu ('.self::PR_WORLD_CHAMPION.') seviyesinin altında oynuyor. Bu rating/seviyede bir insan 60+ kararlı maçlarda bunu tutturamaz; düşük varyans (std '.round($std, 1).') makine tutarlılığıdır.';
        } elseif ($belowEngine >= self::SUSPECT_MIN_FLAGS || $belowWc >= self::SUSPECT_MIN_FLAGS * 2) {
            $verdict = 'selective';
            $reason = 'SEÇİCİ motor şüphesi: medyan PR '.round($median, 1).' (normal) AMA '.$belowWc.' maç dünya-şampiyonu çizgisinin ('.self::PR_WORLD_CHAMPION.') altında, '.$belowEngine.' tanesi motor-eşiğinin ('.self::PR_ABSOLUTE.') altında. İki-tepeli yapı = bazı maçta motor açık, bazısında elle.';
        } else {
            $verdict = 'borderline';
            $reason = 'Sınırda: '.$belowWc.' maç dünya-şampiyonu seviyesinin altında. Tek-maç varyansı olabilir; hamle-hamle motor eşleşmesiyle doğrula.';
        }

        return [
            'n' => $n, 'median' => round($median, 2), 'mean' => round($mean, 2), 'std' => round($std, 2),
            'min' => $n ? min($prs) : 0.0, 'max' => $n ? max($prs) : 0.0,
            'below_wc' => $belowWc, 'below_engine' => $belowEngine,
            'verdict' => $verdict, 'reason' => $reason, 'points' => $pts,
        ];
    }

    /**
     * Rozet/işaretleme için UCUZ şüpheli-hesap kümesi: user_id => {flags, worst_pr}. Cache'li (1 saat).
     * UserResource tablosu bunu okur — her satırda tüm match_results'ı taramaz. Günlük tarama tazeler.
     *
     * @return array<int,array{flags:int,worst_pr:float}>
     */
    public static function suspectIds(): array
    {
        return Cache::remember('cheatscan:suspect_ids', self::CACHE_TTL, function () {
            $map = [];
            foreach (self::suspects() as $s) {
                $map[$s['user_id']] = ['flags' => $s['flags'], 'worst_pr' => $s['worst_pr']];
            }

            return $map;
        });
    }

    /** Cache'i boşalt (tarama/ban sonrası panel güncel kalsın). */
    public static function forget(): void
    {
        Cache::forget('cheatscan:suspect_ids');
    }

    /** match_results satırlarını (gnubg_pr > 0) tek sorguda çek. */
    private static function load(?int $userId): array
    {
        $q = DB::table('match_results')
            ->whereNotNull('gnubg_pr')->where('gnubg_pr', '>', 0)
            ->select([
                'user_id', 'room_code', 'gnubg_pr', 'gnubg_checker_pr', 'pr_decisions',
                'cube_decisions', 'match_length', 'opponent_name', 'opponent_user_id',
                'opponent_pr', 'won', 'created_at',
            ]);
        if ($userId !== null) {
            $q->where('user_id', $userId);
        }

        return $q->get()->all();
    }

    /**
     * Kullanıcı başına PR medyanı + örneklem sayısı. '__n__' anahtarı altında sayımlar.
     * Medyan TÜM maçlardan (tek-user sorgusunda bile site-geneli medyan için ayrı sorgu değil,
     * verilen satır kümesinden) hesaplanır.
     */
    private static function mediansByUser(array $rows): array
    {
        $prs = [];
        foreach ($rows as $r) {
            $prs[(int) $r->user_id][] = (float) $r->gnubg_pr;
        }
        $medians = ['__n__' => []];
        foreach ($prs as $uid => $list) {
            sort($list);
            $n = count($list);
            $medians[$uid] = $n ? $list[intdiv($n, 2)] : 0.0;
            $medians['__n__'][$uid] = $n;
        }

        return $medians;
    }
}
