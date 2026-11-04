<?php

namespace App\Support\League;

use App\Http\Controllers\TournamentController;
use App\Models\LeagueAward;
use App\Models\LeagueMatch;
use App\Models\LeagueParticipant;
use App\Models\LeagueSeason;
use App\Models\Room;
use App\Models\User;
use App\Services\WalletService;
use App\Support\Shield;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Türkiye Online Tavla Ligi — sezon yaşam döngüsü orkestratörü (stateful; DB + LeagueEngine/LeagueBracket).
 *
 * Durum makinesi (§2, §11): draft -> applications -> selection -> league -> knockout -> finished / cancelled.
 * Tek aktif sezon (§2): active_lock UNIQUE kolonu DB düzeyinde ikinci aktif sezonu engeller.
 *
 * RATING (§12): Lig burada rating YAZMAZ. Oynanan maç odası mode=NULL -> mevcut oda settlement'ı
 * (reportRating/MatchBackstop/ForfeitLoss) rating'i TEK sefer uygular. Hükmen/bay/çift-gelmeme maçı
 * oda açmaz -> rating etkilenmez. Böylece "aynı oynanmış maç yalnız bir kez işlenir" garantisi mevcut
 * altyapıdan gelir.
 *
 * Oda bağı (§4): turnuvayla AYNI cache sözleşmesi (TournamentController::roomPlayersKey/roomTargetKey/
 * roomClockKey). roomTargetKey dolu oda enter()'da mode=NULL kalır -> PUANLI. roomPlayersKey yalnız bu
 * eşleşmenin iki oyuncusunu koltuğa yetkilendirir. RoomController'a dokunmaya gerek yok.
 */
class LeagueRuntime
{
    /** Engine katılımcı anlık görüntüsünün league_participants.state'te tutulan alanları. */
    private const STATE_FIELDS = [
        'points', 'wins', 'losses', 'byes', 'byeRounds', 'opponents', 'beaten', 'withdrawnRound', 'status',
    ];

    // ---- Durum geçişleri -----------------------------------------------------

    /** Yeni sezon (draft). active_lock=null -> henüz aktif değil. */
    public static function createSeason(array $attrs = []): LeagueSeason
    {
        return LeagueSeason::create(array_merge([
            'name' => 'Türkiye Online Tavla Ligi',
            'status' => 'draft',
            'rounds_total' => LeagueSeason::LEAGUE_ROUNDS,
        ], $attrs));
    }

    /**
     * Başvuruları aç: draft -> applications. Tek aktif sezon garantisi (§2): active_lock=1 UNIQUE ->
     * başka aktif sezon varsa DB çakışması fırlatır; açıklayıcı hataya çeviririz.
     */
    public static function openApplications(LeagueSeason $s, Carbon|string|null $openAt, Carbon|string|null $closeAt): LeagueSeason
    {
        if ($s->status !== 'draft') {
            throw new \RuntimeException('Başvurular yalnız taslak sezonda açılabilir.');
        }
        try {
            $s->update([
                'status' => 'applications',
                'active_lock' => 1,
                'applications_open_at' => $openAt ? Carbon::parse($openAt) : now(),
                'applications_close_at' => $closeAt ? Carbon::parse($closeAt) : null,
            ]);
        } catch (QueryException $e) {
            if (self::isUniqueViolation($e)) {
                throw new \RuntimeException('Zaten aktif bir sezon var; aynı anda yalnız bir aktif sezon olabilir.');
            }
            throw $e;
        }

        return $s;
    }

    /**
     * Başvuru (§2): yalnız applications durumunda + pencere açıkken + Premium (sunucu doğrular) +
     * aynı kullanıcı bir kez (unique(season,user)). premium_at_apply kaydedilir (sonra düşse de hak korunur).
     */
    public static function apply(LeagueSeason $s, User $u): LeagueParticipant
    {
        if ($s->status !== 'applications') {
            throw new \RuntimeException('Başvurular kapalı.');
        }
        $now = now();
        if ($s->applications_open_at && $now->lt($s->applications_open_at)) {
            throw new \RuntimeException('Başvurular henüz açılmadı.');
        }
        if ($s->applications_close_at && $now->gt($s->applications_close_at)) {
            throw new \RuntimeException('Başvuru süresi doldu.');
        }
        if (($u->plan_active ?? 'free') !== 'premium') {
            throw new \RuntimeException('Başvuru için Premium üyelik gerekir.'); // §2 sunucu tarafı kontrol
        }
        if (LeagueParticipant::where('season_id', $s->id)->where('user_id', $u->id)->exists()) {
            throw new \RuntimeException('Bu sezona zaten başvurdun.');
        }

        return LeagueParticipant::create([
            'season_id' => $s->id,
            'user_id' => $u->id,
            'premium_at_apply' => true,
            'status' => 'pending',
        ]);
    }

    /**
     * Admin katılımcı/yedek seçimi (§2). $map: userId => status (accepted|reserve|rejected|pending).
     * accepted > 48 engellenir (§18 "49 engellenmeli"). Yalnız applications/selection durumunda.
     */
    public static function decide(LeagueSeason $s, array $map, ?int $adminId = null): void
    {
        if (! in_array($s->status, ['applications', 'selection'], true)) {
            throw new \RuntimeException('Seçim yalnız başvuru/seçim aşamasında yapılır.');
        }
        DB::transaction(function () use ($s, $map, $adminId): void {
            foreach ($map as $userId => $status) {
                if (! in_array($status, ['accepted', 'reserve', 'rejected', 'pending'], true)) {
                    throw new \RuntimeException("Geçersiz durum: $status");
                }
                LeagueParticipant::where('season_id', $s->id)->where('user_id', (int) $userId)
                    ->update(['status' => $status, 'decided_by' => $adminId, 'decided_at' => now()]);
            }
            $accepted = LeagueParticipant::where('season_id', $s->id)->where('status', 'accepted')->count();
            if ($accepted > LeagueSeason::MAX_PLAYERS) {
                throw new \RuntimeException('En fazla '.LeagueSeason::MAX_PLAYERS.' asıl oyuncu seçilebilir.');
            }
        });
    }

    /**
     * Lig aşamasını başlat (§2, §18): selection/applications -> league. accepted sayısı 33..48 olmalı
     * (32 veya az -> başlatılamaz). Kura sırası (seed) deterministik atanır ve KİLİTLENİR. Sezon başladıktan
     * sonra yeni oyuncu/yedek alınamaz. İlk tur burada çekilmez (§11 elle kura) -> drawRound(1) ayrı.
     */
    public static function startLeague(LeagueSeason $s): LeagueSeason
    {
        return DB::transaction(function () use ($s): LeagueSeason {
            $s = LeagueSeason::whereKey($s->id)->lockForUpdate()->firstOrFail();
            if (! in_array($s->status, ['applications', 'selection'], true)) {
                throw new \RuntimeException('Lig yalnız seçim aşamasından başlatılabilir.');
            }
            $accepted = LeagueParticipant::where('season_id', $s->id)->where('status', 'accepted')
                ->with('user')->get();
            $n = $accepted->count();
            if ($n < LeagueSeason::MIN_PLAYERS) {
                throw new \RuntimeException('En az '.LeagueSeason::MIN_PLAYERS.' seçilmiş oyuncu gerekir (şu an '.$n.').');
            }
            if ($n > LeagueSeason::MAX_PLAYERS) {
                throw new \RuntimeException('En fazla '.LeagueSeason::MAX_PLAYERS.' oyuncuyla başlanabilir.');
            }

            $players = $accepted->map(fn (LeagueParticipant $p) => [
                'id' => (int) $p->user_id,
                'name' => $p->user?->nickname ?? '',
                'rating' => (int) ($p->user?->rating ?? 1500),
                'avatar' => $p->user?->avatar,
                'premium' => true,
            ])->all();

            $engine = LeagueEngine::initParticipants($players, self::seed($s));
            foreach ($engine as $e) {
                LeagueParticipant::where('season_id', $s->id)->where('user_id', (int) $e['id'])
                    ->update(['seed' => (int) $e['seed'], 'state' => self::stateOf($e)]);
            }

            $s->update(['status' => 'league', 'current_round' => 0]);

            return $s;
        });
    }

    // ---- Tur yönetimi (§11) --------------------------------------------------

    /** Sıradaki tur çekilebilir mi? can + reason döndürür (admin paneli mesajı için). */
    public static function canDraw(LeagueSeason $s): array
    {
        if ($s->status !== 'league') {
            return ['can' => false, 'reason' => 'not_league'];
        }
        $next = (int) $s->current_round + 1;
        if ($next > (int) $s->rounds_total) {
            return ['can' => false, 'reason' => 'league_complete'];
        }
        // §11: sonuçlanmamış VEYA ertelenmiş (deadline geçmiş ama pending) maç varsa yeni tur yok.
        if ($s->current_round > 0) {
            $pending = LeagueMatch::where('season_id', $s->id)->where('round', $s->current_round)
                ->where('result', 'pending')->exists();
            if ($pending) {
                return ['can' => false, 'reason' => 'round_incomplete'];
            }
        }
        // Aynı tur iki kez oluşmasın (§11).
        if (LeagueMatch::where('season_id', $s->id)->where('phase', 'league')->where('round', $next)->exists()) {
            return ['can' => false, 'reason' => 'already_drawn'];
        }

        return ['can' => true, 'reason' => 'ok', 'round' => $next];
    }

    /**
     * Turu çek (§6, §11): eşleştirmeyi üret, league_matches satırlarını oluştur, bay'ı anında işle.
     * İlk tur rastgele. Geçerli eşleşme bulunamazsa (no_valid_pairing) istisna -> admin müdahalesi (§6).
     */
    public static function drawRound(LeagueSeason $s, Carbon|string|null $mandatoryAt, Carbon|string|null $deadlineAt): int
    {
        return DB::transaction(function () use ($s, $mandatoryAt, $deadlineAt): int {
            $s = LeagueSeason::whereKey($s->id)->lockForUpdate()->firstOrFail();
            $chk = self::canDraw($s);
            if (! $chk['can']) {
                throw new \RuntimeException('Tur çekilemez: '.$chk['reason']);
            }
            $round = $chk['round'];
            $participants = self::engineParticipants($s);
            $pr = LeagueEngine::pairRound($participants, $round, self::seed($s), $round === 1);
            if (! ($pr['ok'] ?? false)) {
                // §6: gizlice tekrar-rakip serbest bırakma; açıklayıcı hata, admin çözsün.
                throw new \RuntimeException('Geçerli (tekrar-rakipsiz) eşleşme bulunamadı: '.($pr['reason'] ?? 'bilinmiyor'));
            }

            $target = (int) $s->league_match_length;
            $mAt = $mandatoryAt ? Carbon::parse($mandatoryAt) : null;
            $dAt = $deadlineAt ? Carbon::parse($deadlineAt) : null;
            $pos = 0;
            foreach ($pr['matches'] as [$p1, $p2]) {
                LeagueMatch::create([
                    'season_id' => $s->id, 'phase' => 'league', 'round' => $round, 'bracket_pos' => $pos++,
                    'p1_user_id' => $p1, 'p2_user_id' => $p2, 'result' => 'pending',
                    'target' => $target, 'mandatory_at' => $mAt, 'deadline_at' => $dAt,
                ]);
            }
            // Bay: anında kesinleşir (+1 puan), maç yapılmaz (§6).
            if ($pr['bye'] !== null) {
                LeagueMatch::create([
                    'season_id' => $s->id, 'phase' => 'league', 'round' => $round, 'bracket_pos' => $pos,
                    'p1_user_id' => (int) $pr['bye'], 'p2_user_id' => null, 'bye' => true,
                    'result' => 'bye', 'winner_user_id' => (int) $pr['bye'], 'target' => $target,
                ]);
                $participants = LeagueEngine::applyBye($participants, (int) $pr['bye'], $round);
                self::persistEngine($s, $participants);
            }

            $s->update(['current_round' => $round]);

            return $round;
        });
    }

    // ---- Sonuç -------------------------------------------------------------

    /**
     * Maç sonucunu işle. $type: played | p1_forfeit | p2_forfeit | double_noshow.
     * İdempotent: result zaten pending değilse dokunmaz. Rating'e DOKUNMAZ (§12 — yukarıdaki nota bak).
     *
     * LİG maçı -> LeagueEngine standings güncellenir. ELEME maçı -> yalnız kazanan/sonuç yazılır,
     * standings'e DOKUNULMAZ (nihai lig sıralaması donmuştur §5); sonra ağaç ilerletilir + final kapanırsa
     * finalize edilir.
     */
    public static function recordResult(LeagueMatch $m, string $type, ?int $winnerId = null): void
    {
        $seasonId = null;
        DB::transaction(function () use ($m, $type, $winnerId, &$seasonId): void {
            $m = LeagueMatch::whereKey($m->id)->lockForUpdate()->firstOrFail();
            if ($m->result !== 'pending') {
                return; // §9/§11 çifte sonuç engeli
            }
            $seasonId = (int) $m->season_id;
            $s = LeagueSeason::whereKey($m->season_id)->lockForUpdate()->firstOrFail();
            $p1 = (int) $m->p1_user_id;
            $p2 = (int) $m->p2_user_id;
            $isLeague = $m->phase === 'league';
            $participants = $isLeague ? self::engineParticipants($s) : null;

            if ($type === 'double_noshow') {
                if ($isLeague) {
                    $participants = LeagueEngine::applyDoubleNoShow($participants, $p1, $p2);
                }
                $m->update(['result' => 'double_noshow', 'winner_user_id' => null]);
            } else {
                $w = $type === 'p1_forfeit' ? $p2 : ($type === 'p2_forfeit' ? $p1 : (int) $winnerId);
                if ($w !== $p1 && $w !== $p2) {
                    throw new \RuntimeException('Kazanan bu maçın oyuncusu değil.');
                }
                if ($isLeague) {
                    $participants = LeagueEngine::applyMatch($participants, $w, $w === $p1 ? $p2 : $p1);
                }
                $m->update(['result' => $type === 'played' ? 'played' : $type, 'winner_user_id' => $w]);
            }
            if ($isLeague) {
                self::persistEngine($s, $participants);
            }
        });

        // Eleme: ağacı ilerlet + final kapanırsa bitir (ayrı transaction -> yukarıdaki kilit serbest).
        if ($seasonId !== null) {
            $s = LeagueSeason::find($seasonId);
            if ($s && $s->status === 'knockout') {
                self::advanceKnockout($s);
            }
        }
    }

    // ---- Randevu (§8) --------------------------------------------------------

    public const READY_WINDOW_MIN = 15;   // §9 geçerli saatten itibaren 15 dk beklenir

    public const PRESENCE_SEC = 60;       // §9 "hazır" ısı-vuruşu bu süre içinde yenilenmeli (odadan ayrılınca geçersiz)

    /**
     * Saat teklifi (§8): bir oyuncu tarih/saat teklif eder. Tek taraflı teklif KESİN randevu sayılmaz;
     * karşı taraf onaylayana dek yürürlükteki randevu (confirmed_at) geçerli kalır. Yeni saat turun son
     * izin verilen başlangıcını (deadline_at) aşamaz. Geçmişe teklif engellenir (hükmenden kaçış §8).
     */
    public static function proposeAppointment(LeagueMatch $m, int $byUserId, Carbon|string $at): void
    {
        $at = Carbon::parse($at);
        self::assertPlayer($m, $byUserId);
        if ($m->result !== 'pending') {
            throw new \RuntimeException('Maç sonuçlandı; randevu değiştirilemez.');
        }
        if ($at->isPast()) {
            throw new \RuntimeException('Geçmiş bir saate randevu verilemez.');
        }
        if ($m->deadline_at && $at->gt($m->deadline_at)) {
            throw new \RuntimeException('Randevu, turun son oynanma zamanını aşamaz.');
        }
        $appt = is_array($m->appointment) ? $m->appointment : ['confirmed_at' => null, 'proposal' => null, 'history' => []];
        $appt['proposal'] = ['at' => $at->toIso8601String(), 'by' => $byUserId];
        $appt['history'][] = ['action' => 'propose', 'by' => $byUserId, 'at' => $at->toIso8601String(), 'ts' => now()->toIso8601String()];
        $m->update(['appointment' => $appt]);
        // §14: saat teklifi bildirimi (site+push anlık; e-posta cron hatırlatmalarında). Best-effort.
        self::notifySafe($m, 'appt_proposed', $at, 'Lig: saat teklifi', 'Rakibin bir maç saati teklif etti. Lig maç sayfandan onayla.');
    }

    /**
     * Teklifi onayla (§8): yalnız KARŞI taraf (teklif eden değil) onaylar -> randevu kesinleşir. İki
     * oyuncunun onayıyla saat değişir. Onaylanan saat yürürlüğe girer (confirmed_at), bekleyen teklif temizlenir.
     */
    public static function confirmAppointment(LeagueMatch $m, int $byUserId): void
    {
        self::assertPlayer($m, $byUserId);
        $appt = is_array($m->appointment) ? $m->appointment : [];
        $prop = $appt['proposal'] ?? null;
        if (! $prop) {
            throw new \RuntimeException('Onaylanacak bir teklif yok.');
        }
        if ((int) $prop['by'] === $byUserId) {
            throw new \RuntimeException('Kendi teklifini onaylayamazsın; karşı taraf onaylamalı.');
        }
        $at = Carbon::parse($prop['at']);
        if ($m->deadline_at && $at->gt($m->deadline_at)) {
            throw new \RuntimeException('Randevu son oynanma zamanını aşıyor; yeniden teklif gerekir.');
        }
        $appt['confirmed_at'] = $prop['at'];
        $appt['proposal'] = null;
        $appt['history'][] = ['action' => 'confirm', 'by' => $byUserId, 'at' => $prop['at'], 'ts' => now()->toIso8601String()];
        $m->update(['appointment' => $appt]);
        // §14: kesinleşmiş saat bildirimi. Eski (farklı anchor'lı) hatırlatmalar league:tick'te yeni
        // effectiveStartAt'e göre yeniden planlanır -> bayat hatırlatma gönderilmez.
        self::notifySafe($m, 'appt_confirmed', $at, 'Lig: maç saati kesinleşti', 'Maç saatiniz onaylandı: '.$at->format('d.m.Y H:i').'. Saatinde hazır ol.');
    }

    // ---- Hazır olma + otomatik başlama (§9) ----------------------------------

    /**
     * "Hazırım" (§9): ısı-vuruşu — oyuncu maç ekranındayken tekrar basılır/yenilenir (odadan ayrılınca
     * bayatlar, otomatik katılım kanıtı sayılmaz). İki taraf da TAZE hazırsa oda ayrılır (otomatik başlama)
     * ve kod döner; frontend iki oyuncuyu da odaya sokar. Aynı eşleşme için tek oda (allocateRoom idempotent).
     */
    public static function markReady(LeagueMatch $m, int $userId): ?string
    {
        self::assertPlayer($m, $userId);
        if ($m->result !== 'pending') {
            throw new \RuntimeException('Maç sonuçlandı.');
        }
        $col = $userId === (int) $m->p1_user_id ? 'ready_p1_at' : 'ready_p2_at';
        $m->update([$col => now()]);
        $m->refresh();
        if (self::isPresent($m, (int) $m->p1_user_id, now()) && self::isPresent($m, (int) $m->p2_user_id, now())) {
            return self::allocateRoom($m); // iki taraf taze hazır -> oda aç (otomatik başlama)
        }

        return null;
    }

    private static function isPresent(LeagueMatch $m, int $userId, Carbon $now): bool
    {
        $col = $userId === (int) $m->p1_user_id ? 'ready_p1_at' : 'ready_p2_at';
        $t = $m->$col;

        // "hazır" ısı-vuruşu son PRESENCE_SEC içinde mi (yön-güvenli; Carbon 3 diffInSeconds işaretli).
        return $t !== null && Carbon::parse($t)->gte($now->copy()->subSeconds(self::PRESENCE_SEC));
    }

    /**
     * 15 dk hazır-olma penceresi kararı (§9) — league:tick çağırır. İdempotent; başlamış maça "gelmedi"
     * demez (oda oynanıyor/bitti ise bırakır). Geçerli saatten (effectiveStartAt) 15 dk sonrası:
     *  - yalnız bir taraf TAZE hazır -> diğeri hükmen mağlup
     *  - lig + ikisi de gelmedi -> çift hükmen (ikisi de 0)
     *  - eleme + ikisi de gelmedi -> ikisi de elenir (double_noshow; advance walkover)
     *  - FİNAL + ikisi de gelmedi -> otomatik şampiyon YOK; dokunma (admin yeni tarih belirler)
     */
    public static function resolveReadyWindow(LeagueMatch $m, ?Carbon $now = null): ?string
    {
        $now = $now ?? now();
        if ($m->result !== 'pending') {
            return null;
        }
        $start = $m->effectiveStartAt();
        if (! $start) {
            return null; // takvim yok -> karar verilmez
        }
        if ($now->lt($start->copy()->addMinutes(self::READY_WINDOW_MIN))) {
            return null; // pencere dolmadı
        }
        // §9 "başlamış maça gelmedi deme": oda açılıp oyun başladıysa oda otoriter -> karışma.
        if ($m->room_code) {
            $room = Room::where('code', $m->room_code)->first();
            if ($room && in_array($room->status, ['playing', 'finished'], true)) {
                return null;
            }
        }
        $p1present = self::isPresent($m, (int) $m->p1_user_id, $now);
        $p2present = $m->p2_user_id !== null && self::isPresent($m, (int) $m->p2_user_id, $now);
        if ($p1present && $p2present) {
            return null; // ikisi de orada -> oynasınlar
        }
        if ($p1present !== $p2present) {
            $type = $p1present ? 'p2_forfeit' : 'p1_forfeit';
            self::recordResult($m, $type);

            return $type;
        }
        // İkisi de gelmedi:
        if ($m->phase === 'final') {
            return 'final_no_show'; // §9 otomatik şampiyon yok; admin müdahalesi (sezon knockout kalır)
        }
        self::recordResult($m, 'double_noshow');

        return 'double_noshow';
    }

    // ---- Çekilme (§10) -------------------------------------------------------

    /**
     * Sezon içinde çekilme (§10): önceki sonuçlar korunur; kesinleşmiş GELECEK (mevcut turdaki pending)
     * eşleşme hükmen mağlubiyet (rakip kazanır). Aktif havuzdan çıkar -> sonraki turlarda eşleşmez; doğan
     * tek-sayı bay kuralıyla ele alınır. Yerine YEDEK alınmaz. Çekilen sıralamada puanıyla görünür.
     */
    public static function withdraw(LeagueSeason $s, int $userId, ?int $adminId = null): void
    {
        DB::transaction(function () use ($s, $userId, $adminId): void {
            $s = LeagueSeason::whereKey($s->id)->lockForUpdate()->firstOrFail();
            $p = LeagueParticipant::where('season_id', $s->id)->where('user_id', $userId)->lockForUpdate()->first();
            if (! $p || $p->status !== 'accepted') {
                throw new \RuntimeException('Yalnız aktif katılımcı çekilebilir.');
            }
            $p->update(['status' => 'withdrawn', 'withdrawn_at' => now()]);

            // Mevcut turdaki/eleme aşamasındaki pending maçını hükmen mağlubiyet yap (rakip kazanır §10).
            $pending = LeagueMatch::where('season_id', $s->id)->where('result', 'pending')
                ->where(function ($q) use ($userId) {
                    $q->where('p1_user_id', $userId)->orWhere('p2_user_id', $userId);
                })->whereNotNull('p1_user_id')->whereNotNull('p2_user_id')->get();
            foreach ($pending as $m) {
                $type = (int) $m->p1_user_id === $userId ? 'p1_forfeit' : 'p2_forfeit';
                self::recordResult($m, $type);
            }

            if ($s->status === 'league') {
                self::recomputeLeagueStandings($s); // state.status=withdrawn senkronu + puan korunur
            }
            Shield::audit($adminId, 'league_withdraw', 'season='.$s->id.' user='.$userId, 3);
        });
    }

    // ---- Admin sonuç düzeltme (§13) ------------------------------------------

    /**
     * Yanlış sonucu gerekçeyle düzelt (§13). Açıklanmış eşleşmeler korunur; sonraki turlar otomatik
     * silinmez/yeniden oluşturulmaz. Lig maçı -> standings baştan (authoritative) yeniden hesaplanır.
     * Eleme maçı -> sonuç güncellenir + ağaç yalnız pending aşağı yönde ilerletilir. Rating lig'in işi
     * DEĞİL (oda/rating yönetiminden düzeltilir) -> ikinci kez puan eklenmez.
     */
    public static function correctResult(LeagueMatch $m, string $newType, ?int $winnerId, int $adminId, string $reason): void
    {
        DB::transaction(function () use ($m, $newType, $winnerId, $adminId, $reason): void {
            $m = LeagueMatch::whereKey($m->id)->lockForUpdate()->firstOrFail();
            $s = LeagueSeason::whereKey($m->season_id)->lockForUpdate()->firstOrFail();
            $old = ['result' => $m->result, 'winner' => $m->winner_user_id];

            $p1 = (int) $m->p1_user_id;
            $p2 = (int) $m->p2_user_id;
            if ($newType === 'double_noshow') {
                $m->update(['result' => 'double_noshow', 'winner_user_id' => null, 'admin_note' => $reason]);
            } else {
                $w = $newType === 'p1_forfeit' ? $p2 : ($newType === 'p2_forfeit' ? $p1 : (int) $winnerId);
                if ($w !== $p1 && $w !== $p2) {
                    throw new \RuntimeException('Kazanan bu maçın oyuncusu değil.');
                }
                $m->update(['result' => $newType === 'played' ? 'played' : $newType, 'winner_user_id' => $w, 'admin_note' => $reason]);
            }

            if ($m->phase === 'league') {
                self::recomputeLeagueStandings($s);
            }
            Shield::audit($adminId, 'league_result_correct',
                'match='.$m->id.' old='.json_encode($old).' new='.json_encode(['result' => $m->result, 'winner' => $m->winner_user_id]).' reason='.$reason, 3);
        });

        if ($m->phase !== 'league') {
            self::advanceKnockout(LeagueSeason::find($m->season_id));
        }
    }

    /**
     * Admin erteleme (§10/§13): son oynanma + zorunlu saati ileri al, gerekçeyle. Hatırlatma/hükmen
     * zamanlayıcıları league:tick'te yeni effectiveStartAt'e göre kendiliğinden güncellenir.
     */
    public static function postpone(LeagueMatch $m, Carbon|string|null $mandatoryAt, Carbon|string|null $deadlineAt, int $adminId, string $reason): void
    {
        $upd = ['admin_note' => $reason];
        if ($mandatoryAt) {
            $upd['mandatory_at'] = Carbon::parse($mandatoryAt);
        }
        if ($deadlineAt) {
            $upd['deadline_at'] = Carbon::parse($deadlineAt);
        }
        $m->update($upd);
        Shield::audit($adminId, 'league_postpone', 'match='.$m->id.' reason='.$reason, 3);
        // §14: admin ertelemesi bildirimi (finalde "yeni final tarihi" §9 dahil). Yeni geçerli saate göre.
        $start = $m->fresh()?->effectiveStartAt();
        if ($start) {
            self::notifySafe($m, 'rescheduled', $start, 'Lig: maç ertelendi', 'Maçının tarihi güncellendi: '.$start->format('d.m.Y H:i').'.');
        }
    }

    /** §14 bildirim — best-effort; asla maç/tur akışını bozmaz (push/e-posta hatası yutulur). */
    private static function notifySafe(LeagueMatch $m, string $kind, Carbon $anchor, string $title, string $body): void
    {
        try {
            if ($m->p1_user_id && $m->p2_user_id) {
                LeagueNotifier::fire($m, $kind, $anchor, $title, $body, 'bell', ['site', 'push']);
            }
        } catch (\Throwable $e) {
            // yut
        }
    }

    /**
     * Mevcut lig standings'ini AUTHORITATIVE (maç satırlarından) baştan hesapla. Düzeltme/çekilme sonrası
     * sapma olmadan tutarlılık sağlar. İlk durumdan başlar, lig maçlarını (round,pos) sırasıyla yeniden oynar.
     */
    public static function recomputeLeagueStandings(LeagueSeason $s): void
    {
        $rows = LeagueParticipant::where('season_id', $s->id)
            ->whereIn('status', ['accepted', 'withdrawn'])->with('user')->orderBy('seed')->get();

        $participants = $rows->map(fn (LeagueParticipant $r) => array_merge([
            'id' => (int) $r->user_id,
            'name' => $r->user?->nickname ?? '',
            'rating' => (int) ($r->user?->rating ?? 0),
            'avatar' => $r->user?->avatar,
            'premium' => true,
            'seed' => (int) ($r->seed ?? 0),
        ], self::defaultState()))->all();

        foreach (LeagueMatch::where('season_id', $s->id)->where('phase', 'league')
            ->orderBy('round')->orderBy('bracket_pos')->get() as $m) {
            $p1 = (int) $m->p1_user_id;
            $p2 = (int) $m->p2_user_id;
            switch ($m->result) {
                case 'bye':
                    $participants = LeagueEngine::applyBye($participants, $p1, (int) $m->round);
                    break;
                case 'double_noshow':
                    $participants = LeagueEngine::applyDoubleNoShow($participants, $p1, $p2);
                    break;
                case 'played':
                case 'p1_forfeit':
                case 'p2_forfeit':
                    $w = (int) $m->winner_user_id;
                    if ($w) {
                        $participants = LeagueEngine::applyMatch($participants, $w, $w === $p1 ? $p2 : $p1);
                    }
                    break;
            }
        }

        // Çekilenlerin engine durumunu satırdan senkronla (puanları replay'den korunur).
        $withdrawn = $rows->where('status', 'withdrawn')->pluck('user_id')->map(fn ($x) => (int) $x)->all();
        foreach ($participants as &$p) {
            if (in_array((int) $p['id'], $withdrawn, true)) {
                $p['status'] = 'withdrawn';
            }
        }
        unset($p);

        self::persistEngine($s, $participants);
    }

    private static function assertPlayer(LeagueMatch $m, int $userId): void
    {
        if ($userId !== (int) $m->p1_user_id && $userId !== (int) $m->p2_user_id) {
            throw new \RuntimeException('Bu maçın oyuncusu değilsin.');
        }
    }

    /**
     * Oda sonucunu yakala (§4): room_code'lu, otoriter sonuçlu, iki oyuncusu bu eşleşmeyle EŞLEŞEN
     * oda -> kazananı recordResult'a verir. İdempotent + tekrar-çalıştırılabilir (league:tick + istek anı).
     * Mevcut değilse false; işlendiyse true.
     */
    public static function captureRoomResult(LeagueMatch $m): bool
    {
        if ($m->result !== 'pending' || ! $m->room_code) {
            return false;
        }
        $room = Room::where('code', $m->room_code)->first();
        if (! $room || $room->bot || ! $room->hasVerifiedServerResult()) {
            return false;
        }
        // Koltuklar bu eşleşmenin iki oyuncusuyla aynı mı (id-swap istismarını engelle, winnerIdFromRoom ile aynı).
        $players = [(int) $m->p1_user_id, (int) $m->p2_user_id];
        $seats = [(int) $room->p1_user_id, (int) $room->p2_user_id];
        sort($players);
        sort($seats);
        if ($players[0] <= 0 || $players[0] === $players[1] || $players !== $seats) {
            return false;
        }
        $winnerId = $room->server_match['winner'] === 'white'
            ? (int) $room->p1_user_id : (int) $room->p2_user_id;
        self::recordResult($m, 'played', $winnerId);

        return true;
    }

    /**
     * Bu eşleşme için oyun odası kodu ayır (§4). Turnuvayla aynı cache sözleşmesi -> enter()'da
     * oda PUANLI (mode=NULL) kurulur ve yalnız iki oyuncu koltuğa oturabilir. İdempotent.
     */
    public static function allocateRoom(LeagueMatch $m): string
    {
        if ($m->room_code) {
            // Sonuçsuz kapanmış odayı geri dönüştür (turnuva matchRoom mantığı).
            $old = Room::where('code', $m->room_code)->first();
            if (! $old || $old->status !== 'finished' || $old->hasVerifiedServerResult()) {
                self::cacheRoom($m);

                return $m->room_code;
            }
        }
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $code = '';
            for ($i = 0; $i < 5; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (Room::where('code', $code)->exists());
        $m->update(['room_code' => $code]);
        self::cacheRoom($m);

        return $code;
    }

    private static function cacheRoom(LeagueMatch $m): void
    {
        $code = $m->room_code;
        Cache::put(TournamentController::roomTargetKey($code), (int) $m->target, now()->addDays(2));
        Cache::put(TournamentController::roomPlayersKey($code), [(int) $m->p1_user_id, (int) $m->p2_user_id], now()->addDays(2));
    }

    // ---- Lig aşamasını kesinleştir + nihai sıralamayı dondur (§5) -----------

    /**
     * 8 tur tamamlanınca admin lig aşamasını onaylar: nihai sıralamayı O ANKİ rating ile kalıcı dondurur,
     * ön eleme eşleşmelerini oluşturur, status -> knockout. Çözülemeyen kritik eşitlik varsa engellenir (§5).
     */
    public static function confirmLeaguePhase(LeagueSeason $s): LeagueSeason
    {
        return DB::transaction(function () use ($s): LeagueSeason {
            $s = LeagueSeason::whereKey($s->id)->lockForUpdate()->firstOrFail();
            if ($s->status !== 'league') {
                throw new \RuntimeException('Yalnız lig aşamasında kesinleştirilebilir.');
            }
            if ((int) $s->current_round < (int) $s->rounds_total) {
                throw new \RuntimeException('8 tur tamamlanmadan kesinleştirilemez.');
            }
            $openPending = LeagueMatch::where('season_id', $s->id)->where('phase', 'league')
                ->where('result', 'pending')->exists();
            if ($openPending) {
                throw new \RuntimeException('Sonuçlanmamış lig maçı var.');
            }

            $participants = self::engineParticipants($s); // güncel rating dahil
            $adminOrder = is_array($s->tiebreak_manual) ? $s->tiebreak_manual : [];
            $ties = LeagueEngine::unresolvedCriticalTies($participants, $adminOrder);
            if (! empty($ties)) {
                throw new \RuntimeException('Kritik sıralama eşitliği çözülmeden kesinleştirilemez (admin eşitlik sırası girin).');
            }

            $standings = LeagueEngine::standings($participants, $adminOrder);
            $s->standings_final = [
                'frozen_at' => now()->toIso8601String(),
                'criteria' => ['points', 'oppPoints', 'beatenPoints', 'rating', 'adminOrder'],
                'rows' => $standings, // o anki rating değerleri DAHİL -> sonraki değişimler bunu bozmaz (§5)
            ];
            $s->status = 'knockout';
            $s->save();

            // Ön eleme (§7): aktif oyuncular nihai sırada; 9-24 eşleşir.
            $activeRanked = array_values(array_map(
                fn ($r) => (int) $r['id'],
                array_filter($standings, fn ($r) => $r['status'] === 'active')
            ));
            foreach (LeagueBracket::prelimMatches($activeRanked) as $pm) {
                $p1 = $pm['p1'];
                $p2 = $pm['p2'];
                if ($p1 === null && $p2 === null) {
                    continue; // iki taraf da boş (aktif < ilgili rütbe) -> maç yok, galip yok (§10)
                }
                // §10: tek taraf doluysa walkover (maç yapmadan tur atlar).
                $walkover = ($p1 === null || $p2 === null);
                LeagueMatch::create([
                    'season_id' => $s->id, 'phase' => 'prelim', 'round' => 9, 'bracket_pos' => $pm['pos'],
                    'p1_user_id' => $p1, 'p2_user_id' => $p2,
                    'result' => $walkover ? 'bye' : 'pending',
                    'winner_user_id' => $walkover ? ($p1 ?? $p2) : null,
                    'bye' => $walkover,
                    'target' => (int) $s->knockout_match_length,
                ]);
            }

            return $s;
        });
    }

    // ---- Eleme ağacı (§7) ----------------------------------------------------

    /**
     * Ön eleme bitince SON 16 + sabit ağacı kur (§7). Ön eleme galipleri + nihai lig sırası -> LeagueBracket.
     * r16 oyuncuları bellidir (walkover anında kesinleşir); qf/sf/final besleyici (p*_from_match_id) ile
     * bağlanır ve advanceKnockout ile ilerletilir. İdempotent: r16 zaten varsa dokunmaz.
     */
    public static function buildKnockout(LeagueSeason $s): void
    {
        DB::transaction(function () use ($s): void {
            $s = LeagueSeason::whereKey($s->id)->lockForUpdate()->firstOrFail();
            if ($s->status !== 'knockout') {
                throw new \RuntimeException('Sezon eleme aşamasında değil.');
            }
            if (LeagueMatch::where('season_id', $s->id)->where('phase', 'r16')->exists()) {
                return; // zaten kuruldu
            }
            $prelimPending = LeagueMatch::where('season_id', $s->id)->where('phase', 'prelim')
                ->where('result', 'pending')->exists();
            if ($prelimPending) {
                throw new \RuntimeException('Son 16 için tüm ön eleme maçları bitmeli.');
            }

            $rows = $s->standings_final['rows'] ?? [];
            $rankOf = [];
            foreach ($rows as $r) {
                $rankOf[(int) $r['id']] = (int) $r['rank'];
            }
            $activeRanked = array_values(array_map(fn ($r) => (int) $r['id'],
                array_filter($rows, fn ($r) => $r['status'] === 'active')));
            $directSeeds = LeagueBracket::directSeeds($activeRanked);

            $winners = [];
            foreach (LeagueMatch::where('season_id', $s->id)->where('phase', 'prelim')->get() as $pm) {
                if ($pm->winner_user_id) {
                    $winners[] = ['id' => (int) $pm->winner_user_id, 'rank' => $rankOf[(int) $pm->winner_user_id] ?? 999];
                }
            }

            $k = LeagueBracket::knockout($directSeeds, $winners);
            $len = (int) $s->knockout_match_length;
            $ids = []; // "phase:pos" => match_id

            foreach ($k['r16'] as $mm) {
                $p1 = $mm['p1'];
                $p2 = $mm['p2'];
                $walkover = ($p1 !== null) !== ($p2 !== null); // tam bir taraf dolu
                $row = LeagueMatch::create([
                    'season_id' => $s->id, 'phase' => 'r16', 'round' => 10, 'bracket_pos' => $mm['pos'],
                    'p1_user_id' => $p1, 'p2_user_id' => $p2,
                    'result' => $walkover ? 'bye' : 'pending',
                    'winner_user_id' => $walkover ? ($p1 ?? $p2) : null,
                    'bye' => $walkover, 'target' => $len,
                ]);
                $ids['r16:'.$mm['pos']] = $row->id;
            }
            foreach (['qf' => 11, 'sf' => 12, 'final' => 13] as $phase => $rno) {
                foreach ($k[$phase] as $mm) {
                    $row = LeagueMatch::create([
                        'season_id' => $s->id, 'phase' => $phase, 'round' => $rno, 'bracket_pos' => $mm['pos'],
                        'p1_from_match_id' => $ids[$mm['p1_from'][0].':'.$mm['p1_from'][1]] ?? null,
                        'p2_from_match_id' => $ids[$mm['p2_from'][0].':'.$mm['p2_from'][1]] ?? null,
                        'result' => 'pending', 'target' => $len,
                    ]);
                    $ids[$phase.':'.$mm['pos']] = $row->id;
                }
            }
        });

        self::advanceKnockout($s->refresh());
    }

    /**
     * Ağacı ilerlet: çözülmüş maçların kazananını üst maçın yuvasına taşı; iki besleyicisi de çözülen
     * maçta tek oyuncu kaldıysa walkover (§10 boş yuva -> rakip tur atlar). Sabit nokta (fixpoint). Final
     * kapanırsa finalize. İdempotent.
     */
    public static function advanceKnockout(LeagueSeason $s): void
    {
        DB::transaction(function () use ($s): void {
            $s = LeagueSeason::whereKey($s->id)->lockForUpdate()->firstOrFail();
            if ($s->status !== 'knockout') {
                return;
            }
            $guard = 0;
            do {
                $changed = false;
                $matches = LeagueMatch::where('season_id', $s->id)
                    ->whereIn('phase', ['qf', 'sf', 'final'])->get();
                foreach ($matches as $m) {
                    // Besleyicilerden oyuncuları doldur.
                    foreach (['p1' => 'p1_from_match_id', 'p2' => 'p2_from_match_id'] as $slot => $fromCol) {
                        $userCol = $slot.'_user_id';
                        if ($m->$userCol === null && $m->$fromCol) {
                            $feeder = LeagueMatch::find($m->$fromCol);
                            if ($feeder && $feeder->result !== 'pending') {
                                $m->$userCol = $feeder->winner_user_id; // null olabilir (çift-gelmeme -> kimse)
                                $m->save();
                                $changed = true;
                            }
                        }
                    }
                    if ($m->result !== 'pending') {
                        continue;
                    }
                    // İki besleyici de çözüldü mü?
                    $f1 = $m->p1_from_match_id ? LeagueMatch::find($m->p1_from_match_id) : null;
                    $f2 = $m->p2_from_match_id ? LeagueMatch::find($m->p2_from_match_id) : null;
                    $f1done = ! $f1 || $f1->result !== 'pending';
                    $f2done = ! $f2 || $f2->result !== 'pending';
                    if (! $f1done || ! $f2done) {
                        continue;
                    }
                    $has1 = $m->p1_user_id !== null;
                    $has2 = $m->p2_user_id !== null;
                    if ($has1 && $has2) {
                        continue; // gerçek maç -> oda bekler
                    }
                    if ($has1 xor $has2) {
                        $m->update(['result' => 'bye', 'bye' => true, 'winner_user_id' => $m->p1_user_id ?? $m->p2_user_id]);
                        $changed = true;
                    }
                    // İkisi de null -> kimse ilerlemez; final ise finalize "şampiyon yok" ele alır.
                }
            } while ($changed && ++$guard < 20);
        });

        self::maybeFinalize($s->refresh());
    }

    /** Final kapandıysa (kazanan VEYA kesin kazanansız) sezonu bitir + ödül dağıt (§15). */
    public static function maybeFinalize(LeagueSeason $s): void
    {
        $final = LeagueMatch::where('season_id', $s->id)->where('phase', 'final')->first();
        if (! $final || $final->result === 'pending') {
            return; // final henüz oynanmadı
        }
        // §9: finalde iki taraf da gelmediyse OTOMATİK şampiyon YOK -> admin yeni final tarihi belirler.
        if ($final->winner_user_id === null) {
            return; // sezon bitmez; admin müdahalesi bekler (status knockout kalır)
        }
        DB::transaction(function () use ($s): void {
            $s = LeagueSeason::whereKey($s->id)->lockForUpdate()->firstOrFail();
            if ($s->status !== 'knockout') {
                return;
            }
            $s->update(['status' => 'finished', 'active_lock' => null]); // aktif kilidi bırak (§2)
        });
        self::distributeAwards($s->refresh());
    }

    // ---- Ödüller (§15) -------------------------------------------------------

    /**
     * Sezon geçerli bittiğinde ödülleri OTOMATİK dağıt (ayrı onay beklenmez, §15). İdempotent:
     * league_awards unique(season,user,award_key) -> görev tekrar çalışsa da mükerrer coin/rozet yok.
     * prizes: [{key, coins, badge, desc}] — key: champion|runner_up|semifinalist|quarterfinalist|last16.
     */
    public static function distributeAwards(LeagueSeason $s): void
    {
        if ($s->status !== 'finished') {
            return;
        }
        $prizes = [];
        foreach ((is_array($s->prizes) ? $s->prizes : []) as $p) {
            if (! empty($p['key'])) {
                $prizes[$p['key']] = $p;
            }
        }
        if (empty($prizes)) {
            return;
        }

        $final = LeagueMatch::where('season_id', $s->id)->where('phase', 'final')->first();
        if (! $final || ! $final->winner_user_id) {
            return; // §15 şampiyon belirlenmemiş finalde şampiyonluk ödülü dağıtılmaz
        }
        $champion = (int) $final->winner_user_id;
        $runnerUp = $final->p1_user_id === $champion ? $final->p2_user_id : $final->p1_user_id;

        $byKey = ['champion' => [$champion]];
        if ($runnerUp) {
            $byKey['runner_up'] = [(int) $runnerUp];
        }
        $byKey['semifinalist'] = self::knockoutLosers($s, 'sf');
        $byKey['quarterfinalist'] = self::knockoutLosers($s, 'qf');
        $byKey['last16'] = self::knockoutLosers($s, 'r16');

        $wallet = app(WalletService::class);
        foreach ($byKey as $key => $userIds) {
            if (empty($prizes[$key])) {
                continue;
            }
            foreach ($userIds as $uid) {
                self::grantAward($s, (int) $uid, $key, $prizes[$key], $wallet);
            }
        }
    }

    /** Bir aşamada ELENEN (maçı kaybeden) oyuncular (ödül grubu). Walkover/çift-gelmeme kaybedeni yok sayılır. */
    private static function knockoutLosers(LeagueSeason $s, string $phase): array
    {
        $out = [];
        foreach (LeagueMatch::where('season_id', $s->id)->where('phase', $phase)->get() as $m) {
            if ($m->winner_user_id && $m->p1_user_id && $m->p2_user_id) {
                $out[] = $m->p1_user_id === $m->winner_user_id ? (int) $m->p2_user_id : (int) $m->p1_user_id;
            }
        }

        return $out;
    }

    /** Tek (user,award_key) ödülü: idempotent satır + coin + rozet. Hata league_awards.error'a yazılır (§15). */
    private static function grantAward(LeagueSeason $s, int $userId, string $key, array $prize, WalletService $wallet): void
    {
        $coins = (int) ($prize['coins'] ?? 0);
        $badge = $prize['badge'] ?? null;
        // unique(season,user,award_key): satır VARSA zaten dağıtıldı -> çık (idempotent).
        $award = LeagueAward::firstOrCreate(
            ['season_id' => $s->id, 'user_id' => $userId, 'award_key' => $key],
            ['coins' => $coins, 'badge' => $badge, 'desc' => $prize['desc'] ?? null]
        );
        if (! $award->wasRecentlyCreated) {
            return; // daha önce dağıtıldı
        }
        try {
            if ($coins > 0) {
                $u = User::find($userId);
                if ($u) {
                    // idempotencyKey ref: league_award:{id} -> ikinci kez coin eklenmez.
                    $wallet->credit($u, $coins, 'league_prize', 'league_award', $award->id, 'league_award:'.$award->id);
                }
            }
            if ($badge) {
                self::awardBadge($userId, $badge);
            }
        } catch (\Throwable $e) {
            $award->update(['error' => mb_substr($e->getMessage(), 0, 255)]); // panelde görünür
        }
    }

    /** Rozet ekle (users.badges JSON; AuthController::awardBadges ile aynı depolama). İdempotent. */
    private static function awardBadge(int $userId, string $badge): void
    {
        $u = User::find($userId);
        if (! $u) {
            return;
        }
        $badges = is_array($u->badges) ? $u->badges : [];
        if (! in_array($badge, $badges, true)) {
            $badges[] = $badge;
            $u->badges = array_values($badges);
            $u->save();
        }
    }

    // ---- İç yardımcılar ------------------------------------------------------

    /**
     * Mevcut engine katılımcı dizisini DB'den yeniden kur: lig oyuncuları (accepted + withdrawn), seed
     * sırasıyla; state alanları satırdan, rating GÜNCEL kullanıcıdan (4. ölçüt hesap anındaki değer §5).
     */
    public static function engineParticipants(LeagueSeason $s): array
    {
        $rows = LeagueParticipant::where('season_id', $s->id)
            ->whereIn('status', ['accepted', 'withdrawn'])
            ->with('user')->orderBy('seed')->get();

        return $rows->map(function (LeagueParticipant $r): array {
            $st = is_array($r->state) ? $r->state : [];

            return array_merge([
                'id' => (int) $r->user_id,
                'name' => $r->user?->nickname ?? '',
                'rating' => (int) ($r->user?->rating ?? 0),
                'avatar' => $r->user?->avatar,
                'premium' => true,
                'seed' => (int) ($r->seed ?? 0),
            ], self::defaultState(), array_intersect_key($st, array_flip(self::STATE_FIELDS)));
        })->all();
    }

    private static function persistEngine(LeagueSeason $s, array $participants): void
    {
        foreach ($participants as $e) {
            LeagueParticipant::where('season_id', $s->id)->where('user_id', (int) $e['id'])
                ->update(['state' => self::stateOf($e)]);
        }
    }

    private static function stateOf(array $e): array
    {
        $out = [];
        foreach (self::STATE_FIELDS as $f) {
            $out[$f] = $e[$f] ?? self::defaultState()[$f];
        }

        return $out;
    }

    private static function defaultState(): array
    {
        return [
            'points' => 0, 'wins' => 0, 'losses' => 0, 'byes' => 0, 'byeRounds' => [],
            'opponents' => [], 'beaten' => [], 'withdrawnRound' => null, 'status' => 'active',
        ];
    }

    private static function seed(LeagueSeason $s): string
    {
        return hash('sha256', 'league:'.$s->id.':'.($s->created_at?->timestamp ?? 0));
    }

    private static function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) ($e->errorInfo[1] ?? '');

        return in_array($code, ['19', '23000', '1062'], true) // sqlite 19 / mysql 1062
            || str_contains(strtolower($e->getMessage()), 'unique');
    }
}
