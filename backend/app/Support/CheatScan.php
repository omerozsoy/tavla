<?php

namespace App\Support;

use App\Models\Setting;
use App\Services\Analysis\AnalysisOrchestrator;
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

    /** HAVUZLANMIŞ hamle-hamle motor eşleşmesi bu %'nin üstündeyse KANIT → "kesin suçlu". Canlı
     *  kalibrasyon (2026-10-27): güçlü İNSAN havuzda en fazla ~%82; gerçek motor ~%97. %90 = güvenli
     *  ayraç. (TEK maç %85-96'ya çıkabilir — küçük örneklem/seçim yanlılığı; bu yüzden HAVUZLA, bkz confirmation().) */
    public const MOVE_MATCH_CERTAIN = 90;

    /** "Kesin" için havuzda en az bu kadar GERÇEK karar olmalı (küçük örneklem %90'ı rastgele aşabilir). */
    public const MOVE_MATCH_MIN_SAMPLE = 100;

    /** confirmation() en düşük-PR kaç maçı havuzlar (maliyet tavanı — her maç ~244KB review parse). */
    public const CONFIRM_MATCHES = 12;

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

        // Beyaz-liste: yönetici "bu oyuncu zaten çok iyi / temiz" dediği hesaplar listeden çıkar.
        foreach (self::whitelistIds() as $wid) {
            unset($byUser[$wid]);
        }

        // Hesabı KAPATILAN (Hesabı Kapat → AccountClosure::close, account_ban_events action='closed')
        // hesaplar triyaj listesinde yer kaplamasın — kapatma nihai aksiyon. ENGELLE (block) farklı:
        // geri alınabilir, bilerek listede kalır ("Engeli kaldır" ile). reopen banned_at'ı sıfırlar +
        // son olayı 'reopened' yapar → hesap yeniden listelenir.
        foreach (self::closedUserIds(array_keys($byUser)) as $cid) {
            unset($byUser[$cid]);
        }

        $users = DB::table('users')->whereIn('id', array_keys($byUser))
            ->get(['id', 'nickname', 'first_name', 'rating', 'banned_at', 'ban_reason', 'created_at'])->keyBy('id');

        $out = [];
        foreach ($byUser as $uid => $agg) {
            $u = $users[$uid] ?? null;
            // KVKK ile silinen (anonimleştirilen) hesap: mali geçmişi olduğu için maç satırları
            // korunur ama hesap artık yok (UserEraser::anonymize banned_at'i DOĞRUDAN yazar,
            // account_ban_events'e satır atmaz → closedUserIds yakalayamaz). Triyaj dışı: aksiyon
            // alınacak bir hesap değil.
            if (($u?->ban_reason) === 'account_deleted') {
                continue;
            }
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

    /**
     * Beyaz-liste: dedektörün yanlış-pozitif işaretlediği GERÇEKTEN iyi oyuncular (ör. turnuva/Türkiye
     * şampiyonu — tutarlı düşük PR = yetenek, motor değil). Bu uid'ler suspects()/rozet dışı kalır.
     * Setting('cheat_whitelist') = virgülle ayrılmış uid listesi. Admin panelden eklenir/çıkarılır.
     *
     * @return array<int,int>
     */
    public static function whitelistIds(): array
    {
        $raw = Setting::get('cheat_whitelist', '');

        return array_values(array_filter(array_map(
            fn ($x) => (int) trim($x),
            explode(',', $raw)
        )));
    }

    /** Beyaz-listeye ekle/çıkar (tekil uid). Cache + suspectIds tazelenir. */
    public static function setWhitelisted(int $uid, bool $on): void
    {
        $ids = self::whitelistIds();
        $ids = $on ? array_unique([...$ids, $uid]) : array_values(array_diff($ids, [$uid]));
        Setting::put('cheat_whitelist', implode(',', $ids));
        self::forget();
    }

    /**
     * HAMLE-HAMLE MOTOR EŞLEŞMESİ (kesin kanıt katmanı): bir maçta oyuncunun her checker kararını
     * gnubg'nin en-iyi hamlesiyle karşılaştır. Kaynak: match_results.gnubg_review.log (her kayıt
     * {player,notation,best,loss,dice}; loss=0 => motorun #1 hamlesi oynandı). Oyuncu rengi odadan
     * (p1=white, p2=black — RoomResult ile aynı). İnsan uzun maçta ~%40-60 top-move tutar; %85+ = motor.
     *
     * @return array{ok:bool,color:?string,total:int,exact:int,exact_pct:int,near:int,near_pct:int,
     *               moves:array<int,array{dice:string,played:string,best:string,loss:float,match:bool}>,note:?string}
     */
    public static function moveMatch(int $userId, string $roomCode): array
    {
        $empty = ['ok' => false, 'color' => null, 'total' => 0, 'exact' => 0, 'exact_pct' => 0,
            'near' => 0, 'near_pct' => 0, 'moves' => [], 'note' => null];

        $mr = DB::table('match_results')->where('user_id', $userId)->where('room_code', $roomCode)
            ->first(['gnubg_review']);
        if (! $mr || ! $mr->gnubg_review) {
            return [...$empty, 'note' => 'Bu maçın gnubg analizi (review) yok — eşleşme hesaplanamıyor.'];
        }
        $j = json_decode($mr->gnubg_review, true);
        $log = is_array($j['log'] ?? null) ? $j['log'] : null;
        if (! $log) {
            return [...$empty, 'note' => 'Review log boş/bozuk.'];
        }

        // Renk: p1=white, p2=black (RoomResult ile aynı). Oda silinmişse review'dan tek-renk çıkaramayız.
        $room = DB::table('rooms')->where('code', $roomCode)->first(['p1_user_id', 'p2_user_id']);
        $color = null;
        if ($room) {
            $color = (int) $room->p1_user_id === $userId ? 'white'
                : ((int) $room->p2_user_id === $userId ? 'black' : null);
        }
        if ($color === null) {
            return [...$empty, 'note' => 'Oyuncunun rengi belirlenemedi (oda silinmiş olabilir).'];
        }

        $moves = [];
        $exact = $near = 0;
        foreach ($log as $x) {
            if (! is_array($x) || ($x['player'] ?? null) !== $color || ! isset($x['best'])) {
                continue; // yalnız bu oyuncunun checker kararları (küp/pas kaydında 'best' yok)
            }
            // SADECE GERÇEK SEÇİM olan kararları say — PR'ın "sayılan karar" kapısıyla (AnalysisOrchestrator::
            // prFromReviewLog) BİREBİR AYNI. Aksi halde zorunlu (tek legal hamle), bariz (tüm adaylar eşdeğer)
            // ve küp kararları (cands yok) hep loss=0 ile exact%'i şişirir → GÜÇLÜ İNSAN da %85+ eşleşir
            // (ahselbah/AzadMamedov yanlış-pozitifinin kök nedeni). "İnsan ~%40-60" baz oranı tam da bu
            // zor kararlar üzerinde tanımlı; forced/obvious dahil edilince karşılaştırma anlamsızlaşır.
            if (isset($x['cube']['chosen']) || ! empty($x['fill'])) {
                continue; // küp kararı / tur-dolgu-dance → checker top-move değil
            }
            $cands = is_array($x['cands'] ?? null) ? $x['cands'] : [];
            if (count($cands) < 2) {
                continue; // tek yasal hamle = zorunlu
            }
            $eqs = array_map(static fn ($c) => (float) ($c['equity'] ?? 0), $cands);
            if ((max($eqs) - min($eqs)) < 0.001) {
                continue; // obvious (en iyi–en kötü spread < eşik) — gerçek seçim yok
            }
            $loss = (float) ($x['loss'] ?? 0);
            if (! is_finite($loss) || $loss > AnalysisOrchestrator::CHK_LOSS_MAX) {
                continue; // ÇÖP KALKANI parite (PR tarafıyla aynı): bozuk/aşırı checker kaybı sayılmaz
            }
            $isExact = $loss <= 0.001;
            $exact += $isExact ? 1 : 0;
            $near += $loss <= 0.02 ? 1 : 0;
            $moves[] = [
                'dice' => is_array($x['dice'] ?? null) ? implode('-', $x['dice']) : (string) ($x['dice'] ?? ''),
                'played' => (string) ($x['notation'] ?? ''),
                'best' => (string) ($x['best'] ?? ''),
                'loss' => round($loss, 3),
                'match' => $isExact,
            ];
        }
        $total = count($moves);

        return [
            'ok' => $total > 0,
            'color' => $color,
            'total' => $total,
            'exact' => $exact,
            'exact_pct' => $total ? (int) round(100 * $exact / $total) : 0,
            'near' => $near,
            'near_pct' => $total ? (int) round(100 * $near / $total) : 0,
            'moves' => $moves,
            'note' => $total === 0 ? 'Bu renkte checker kararı bulunamadı.' : null,
        ];
    }

    /**
     * KESİN KANIT özeti: HAVUZLANMIŞ hamle-hamle motor eşleşmesi. Oyuncunun EN DÜŞÜK-PR (en suçlayıcı)
     * maçlarını, yeterli örnekleme (≥ MOVE_MATCH_MIN_SAMPLE gerçek karar) ulaşana dek havuzlar.
     * exact_pct ≥ MOVE_MATCH_CERTAIN && total ≥ MIN_SAMPLE ise 'certain' = true. Cache'li (ağır parse).
     *
     * ⚠ NEDEN HAVUZ (2026-10-27 kök düzeltme): TEK maçın top-move oranı güçlü İNSANI bottan AYIRAMAZ.
     * Küçük örneklem (bir maçta ~10-40 gerçek karar) + seçim yanlılığı (yüzlerce maçtan en iyisini
     * seçince) güçlü oyuncu tek iyi maçta %85-96 top-move atar. Canlı kalibrasyon: 47 flag'li hesabın
     * HEPSİ havuzda %60-82 (motor değil); gerçek bir motor kullanıcısı yüzlerce kararda bile %95+ kalır.
     * Eşik %90 + ≥MIN_SAMPLE karar = insan tavanı (~%82) ile bot (~%97) arasında güvenli ayraç.
     *
     * @return array{room_code:?string,exact_pct:int,total:int,matches:int,certain:bool}|null
     */
    public static function confirmation(int $userId): ?array
    {
        return Cache::remember("cheatscan:confirm:$userId", self::CACHE_TTL, function () use ($userId) {
            $rooms = DB::table('match_results')
                ->where('user_id', $userId)
                ->whereNotNull('gnubg_review')->whereNotNull('room_code')
                ->whereNotNull('gnubg_pr')->where('gnubg_pr', '>', 0)
                ->orderBy('gnubg_pr')              // en düşük PR = en suçlayıcı önce
                ->limit(self::CONFIRM_MATCHES)     // maliyet tavanı (her maç ~244KB review parse)
                ->pluck('room_code');

            $exact = $total = $matches = 0;
            $worstRoom = null;
            foreach ($rooms as $rc) {
                $mm = self::moveMatch($userId, $rc);
                if (! $mm['ok']) {
                    continue;
                }
                $worstRoom ??= $rc; // ilk işlenen = en düşük PR
                $exact += $mm['exact'];
                $total += $mm['total'];
                $matches++;
                if ($total >= self::MOVE_MATCH_MIN_SAMPLE + 50) {
                    break; // yeterli örneklem — erken çık (parse maliyetini sınırla)
                }
            }
            if ($total === 0) {
                return null;
            }

            $pct = (int) round(100 * $exact / $total);

            return [
                'room_code' => $worstRoom,
                'exact_pct' => $pct,
                'total' => $total,
                'matches' => $matches,
                'certain' => $pct >= self::MOVE_MATCH_CERTAIN && $total >= self::MOVE_MATCH_MIN_SAMPLE,
            ];
        });
    }

    /**
     * Verilen uid'lerden hesabı ŞU AN KAPALI olanlar (en son account_ban_events olayı 'closed').
     * block() bu tabloya yazmaz → yalnız "Hesabı Kapat" akışı buraya düşer. reopen 'reopened' yazar.
     *
     * @param  array<int,int>  $ids
     * @return array<int,int>
     */
    private static function closedUserIds(array $ids): array
    {
        if ($ids === [] || ! Schema::hasTable('account_ban_events')) {
            return [];
        }
        $events = DB::table('account_ban_events')
            ->whereIn('user_id', $ids)
            ->orderByDesc('id')
            ->get(['user_id', 'action']);
        $latest = [];
        foreach ($events as $e) {
            $latest[(int) $e->user_id] ??= $e->action; // id desc → ilk görülen = en son olay
        }

        return array_keys(array_filter($latest, fn ($a) => $a === 'closed'));
    }

    /** match_results satırlarını (gnubg_pr > 0) tek sorguda çek. */
    private static function load(?int $userId): array
    {
        $q = DB::table('match_results')
            ->whereNotNull('gnubg_pr')->where('gnubg_pr', '>', 0)
            // BOT maçlarını ELE: PvB odasında EĞİTİM/İPUCU modu açık olabilir (oyuncu gnubg ipucuna
            // bakarak oynar) → düşük PR MEŞRU, motor-yardımı sinyali DEĞİL. İnsan-insan maçı değil.
            // Oda silinmişse (code artık rooms'ta yok) bot olup olmadığı bilinemez → listede kalır.
            ->whereNotExists(function ($sub) {
                $sub->select(DB::raw(1))->from('rooms')
                    ->whereColumn('rooms.code', 'match_results.room_code')
                    ->where('rooms.bot', true);
            })
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
