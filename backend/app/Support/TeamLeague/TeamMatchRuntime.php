<?php

namespace App\Support\TeamLeague;

use App\Http\Controllers\TournamentController;
use App\Models\Room;
use App\Models\Team;
use App\Models\TeamMatch;
use App\Models\TeamMatchGame;
use App\Models\TeamMatchLineup;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Takım karşılaşması (5'e 5) çalışma zamanı (§7-§9). League modülüyle AYNI oda sözleşmesi:
 * oda PUANLI (mode=NULL) kurulur → bireysel rating'i MEVCUT oda settlement'ı (reportRating/
 * MatchBackstop/ForfeitLoss) TEK sefer uygular; hiç oda açılmayan hükmen/no-show eşleşme rating'i
 * ETKİLEMEZ (§9). İdempotent + tekrar-çalıştırılabilir (tick güvenli). Tüm yetki/kural sunucuda.
 */
class TeamMatchRuntime
{
    public const PRESENCE_SEC = 60; // "Hazırım" ısı-vuruşu bu süre içinde tazelenmeli (odadan çıkınca bayatlar)

    public function __construct(private TeamService $teams) {}

    // ---- Meydan okuma / takvim (§7) ----------------------------------------

    public function proposeMatch(Team $home, Team $away, Carbon $at, int $actorId): TeamMatch
    {
        if ((int) $home->id === (int) $away->id) {
            throw new TeamException('same_team', 422);
        }
        if ($home->status !== 'active' || $away->status !== 'active') {
            throw new TeamException('team_closed', 409);
        }
        $this->teams->managerOrFail($home, $actorId);
        if ($at->lte(now())) {
            throw new TeamException('time_in_past', 422);
        }
        $m = TeamMatch::create([
            'home_team_id' => $home->id, 'away_team_id' => $away->id, 'proposed_by_team_id' => $home->id,
            'scheduled_at' => $at, 'status' => 'proposed',
        ]);
        TeamNotifier::fire($m->id, 'team_challenge', $at, $this->teamManagers((int) $away->id),
            'Meydan okuma', $home->name.' sizi 5v5 karşılaşmaya davet etti.');

        return $m;
    }

    /** Proposed maçta yeni saat öner; teklif eden taraf değişir → KARŞI taraf onaylar. */
    public function reschedule(TeamMatch $m, int $actorId, Carbon $at): void
    {
        if ($m->status !== 'proposed') {
            throw new TeamException('not_reschedulable', 409);
        }
        $team = $this->actorTeam($m, $actorId);
        if ($at->lte(now())) {
            throw new TeamException('time_in_past', 422);
        }
        $m->update(['scheduled_at' => $at, 'proposed_by_team_id' => $team->id]);
    }

    public function acceptMatch(TeamMatch $m, int $actorId): void
    {
        if ($m->status !== 'proposed') {
            throw new TeamException('not_pending', 409);
        }
        // Kabul eden = teklif EDEN takımın KARŞISINDAKİ takımın yöneticisi.
        $accepterId = (int) $m->proposed_by_team_id === (int) $m->home_team_id
            ? (int) $m->away_team_id : (int) $m->home_team_id;
        $this->teams->managerOrFail(Team::findOrFail($accepterId), $actorId);

        DB::transaction(function () use ($m) {
            $fresh = TeamMatch::query()->lockForUpdate()->findOrFail($m->id);
            if ($fresh->status !== 'proposed') {
                throw new TeamException('not_pending', 409);
            }
            $at = $fresh->scheduled_at;
            if ($at->lt(now()->addHours(TeamRules::MATCH_MIN_LEAD_HOURS))) {
                throw new TeamException('too_soon', 422); // onay anında başlangıca <1 saat → yeni saat gerek
            }
            foreach ([(int) $fresh->home_team_id, (int) $fresh->away_team_id] as $tid) {
                if ($this->activeMatchCount($tid) >= TeamRules::MAX_ACTIVE_MATCHES) {
                    throw new TeamException('too_many_active_matches', 409);
                }
                if ($this->hasTimeConflict($tid, $at, (int) $fresh->id)) {
                    throw new TeamException('time_conflict', 409);
                }
            }
            if ($this->rematchBlocked((int) $fresh->home_team_id, (int) $fresh->away_team_id, (int) $fresh->id)) {
                throw new TeamException('rematch_cooldown', 409);
            }
            $fresh->update(['status' => 'scheduled', 'accepted_at' => now(), 'month_key' => $at->format('Y-m')]);
            $m->setRawAttributes($fresh->getAttributes());
            $m->syncOriginal();
        });

        TeamNotifier::fire($m->id, 'team_match_scheduled', $m->scheduled_at, $this->matchRecipients($m),
            'Karşılaşma onaylandı', 'Karşılaşma takvime alındı. Kadronu başlangıçtan 10 dk önce kilitlenmeden gir.');
    }

    /** proposed: tek taraf iptal eder. scheduled: ≥1 saat kala KARŞILIKLI onay. Döner: 'cancelled'|'pending'. */
    public function cancelMatch(TeamMatch $m, int $actorId, ?string $reason = null): string
    {
        if (in_array($m->status, ['finished', 'cancelled'], true)) {
            throw new TeamException('not_cancellable', 409);
        }
        $team = $this->actorTeam($m, $actorId);
        if ($m->status === 'proposed') {
            $m->update(['status' => 'cancelled', 'cancelled_by' => $actorId, 'cancel_reason' => $reason]);

            return 'cancelled';
        }
        // scheduled
        if ($m->lineup_locked_at || $m->scheduled_at->lt(now()->addHours(TeamRules::MATCH_MIN_LEAD_HOURS))) {
            throw new TeamException('admin_only_now', 409); // §7: sonrasında yalnız admin
        }
        if ($m->cancel_requested_by && (int) $m->cancel_requested_by !== (int) $team->id) {
            $m->update(['status' => 'cancelled', 'cancelled_by' => $actorId, 'cancel_reason' => $reason]);

            return 'cancelled';
        }
        $m->update(['cancel_requested_by' => $team->id]);

        return 'pending';
    }

    public function adminCancel(TeamMatch $m, int $adminId, string $reason): void
    {
        if ($m->status === 'finished') {
            throw new TeamException('not_cancellable', 409);
        }
        $m->update(['status' => 'cancelled', 'cancelled_by' => $adminId, 'cancel_reason' => $reason, 'admin_note' => $reason]);
    }

    /**
     * Admin sonuç düzeltme (§12). Takım skorunu/sonucunu gerekçeyle güncelle → ana sıralama (türetilmiş,
     * her zaman tutarlı) + aylık tablo kendiliğinden düzelir; takım ortalamaları + aylık ödül yeniden
     * hesaplanır (ödül dağıtımı idempotent: eksik kupa eklenir; yanlış verilmiş kupa geri alma Filament işi).
     */
    public function adminCorrectResult(TeamMatch $m, array $data, int $adminId, string $reason): void
    {
        $result = $data['result'] ?? null;
        if (! in_array($result, ['home_win', 'away_win', 'draw', 'double_forfeit'], true)) {
            throw new TeamException('invalid_result', 422);
        }
        $home = (float) ($data['home_score'] ?? 0);
        $away = (float) ($data['away_score'] ?? 0);
        $m->update([
            'status' => 'finished', 'result' => $result, 'home_score' => $home, 'away_score' => $away,
            'finished_at' => $m->finished_at ?? now(), 'admin_note' => $reason,
        ]);
        foreach ([(int) $m->home_team_id, (int) $m->away_team_id] as $tid) {
            $t = Team::find($tid);
            if ($t && $t->status === 'active') {
                $this->teams->recompute($t);
            }
        }
        if ($m->month_key) {
            app(TeamStandings::class)->distributeMonthlyAwards($m->month_key);
        }
    }

    // ---- Kadro (§8) --------------------------------------------------------

    /** Gizli kadro ayarla (kilide kadar rakibe açılmaz — API serileştirme gate'i). @param list<int> $userIds */
    public function setLineup(TeamMatch $m, int $teamId, int $actorId, array $userIds): void
    {
        if (! in_array($teamId, [(int) $m->home_team_id, (int) $m->away_team_id], true)) {
            throw new TeamException('not_in_match', 404);
        }
        if ($m->status !== 'scheduled') {
            throw new TeamException('lineup_closed', 409);
        }
        if ($m->lineup_locked_at) {
            throw new TeamException('lineup_locked', 409);
        }
        $this->teams->managerOrFail(Team::findOrFail($teamId), $actorId);
        $userIds = array_values(array_map('intval', $userIds));
        if (count($userIds) !== TeamRules::LINEUP_SIZE) {
            throw new TeamException('lineup_size', 422);
        }
        if (count(array_unique($userIds)) !== TeamRules::LINEUP_SIZE) {
            throw new TeamException('duplicate_player', 422); // aynı oyuncu birden fazla yerde olamaz
        }
        foreach ($userIds as $uid) {
            if (! TeamMember::where('team_id', $teamId)->where('user_id', $uid)->exists()) {
                throw new TeamException('not_a_member', 422); // yeni üye de olur; kilitten önce katılmışsa seçilebilir
            }
        }
        DB::transaction(function () use ($m, $teamId, $userIds) {
            TeamMatchLineup::where('match_id', $m->id)->where('team_id', $teamId)->delete();
            foreach ($userIds as $slot0 => $uid) {
                TeamMatchLineup::create([
                    'match_id' => $m->id, 'team_id' => $teamId, 'slot' => $slot0 + 1, 'user_id' => $uid,
                ]);
            }
        });
    }

    /**
     * Kadro kilidi (§8): başlangıçtan 10 dk önce. Tick çağırır. Beş geçerli oyuncusu (üye + aktif Premium)
     * olmayan takım karşılaşmayı HÜKMEN kaybeder (0-5, oyun YOK, rating YOK). İki taraf eksikse iptal.
     * İki taraf tam → kadrolar açılır, 5 oyun (slot eşleşmesi) oluşturulur.
     */
    public function lockMatch(TeamMatch $m, ?Carbon $now = null): void
    {
        $now = $now ? $now->copy() : now();
        if ($m->status !== 'scheduled' || $m->lineup_locked_at) {
            return;
        }
        if (! $m->scheduled_at || $now->lt($m->scheduled_at->copy()->subMinutes(TeamRules::LOCK_BEFORE_MINUTES))) {
            return;
        }
        $finalized = false;
        DB::transaction(function () use ($m, $now, &$finalized) {
            $fresh = TeamMatch::query()->lockForUpdate()->findOrFail($m->id);
            if ($fresh->status !== 'scheduled' || $fresh->lineup_locked_at) {
                return;
            }
            $homeValid = $this->validLineup($fresh, (int) $fresh->home_team_id);
            $awayValid = $this->validLineup($fresh, (int) $fresh->away_team_id);
            $homeOk = count($homeValid) === TeamRules::LINEUP_SIZE;
            $awayOk = count($awayValid) === TeamRules::LINEUP_SIZE;

            if (! $homeOk && ! $awayOk) {
                $fresh->update(['status' => 'cancelled', 'lineup_locked_at' => $now, 'finished_at' => $now, 'cancel_reason' => 'both_incomplete']);

                return; // iki taraf eksik → iptal (§8)
            }
            if (! $homeOk || ! $awayOk) {
                $fresh->update([
                    'status' => 'finished', 'lineup_locked_at' => $now, 'finished_at' => $now,
                    'home_score' => $homeOk ? 5 : 0, 'away_score' => $awayOk ? 5 : 0,
                    'result' => $homeOk ? 'home_win' : 'away_win', // tek taraflı hükmen 0-5/5-0 (§9)
                ]);
                $finalized = true;

                return; // oyun oluşturulmaz → rating etkilenmez
            }
            // İki taraf tam: kadroları işaretle, 5 oyun kur (gizlilik biter).
            TeamMatchLineup::where('match_id', $fresh->id)->update(['premium_at_lock' => true]);
            foreach (range(1, TeamRules::LINEUP_SIZE) as $slot) {
                TeamMatchGame::create([
                    'match_id' => $fresh->id, 'slot' => $slot, 'status' => 'pending',
                    'home_user_id' => TeamMatchLineup::where('match_id', $fresh->id)->where('team_id', $fresh->home_team_id)->where('slot', $slot)->value('user_id'),
                    'away_user_id' => TeamMatchLineup::where('match_id', $fresh->id)->where('team_id', $fresh->away_team_id)->where('slot', $slot)->value('user_id'),
                ]);
            }
            $fresh->update(['lineup_locked_at' => $now]);
            $m->setRawAttributes($fresh->getAttributes());
            $m->syncOriginal();
        });

        $m->refresh();
        if ($finalized) {
            $this->afterFinalize($m);
        } elseif ($m->lineup_locked_at && $m->status === 'scheduled') {
            TeamNotifier::fire($m->id, 'team_lineup_locked', $m->scheduled_at, $this->matchRecipients($m),
                'Kadrolar açıklandı', '5v5 kadroları kilitlendi. Maç saatinde maç odanda "Hazırım" de.');
        }
    }

    // ---- Hazır olma + başlatma (§8/§9) -------------------------------------

    /** "Hazırım" ısı-vuruşu. İki taraf TAZE hazır + başlangıç saati geçtiyse oda açılır (kod döner). */
    public function markReady(TeamMatch $m, int $userId): ?string
    {
        if ($m->status !== 'scheduled' || ! $m->lineup_locked_at) {
            throw new TeamException('not_live', 409);
        }
        $game = TeamMatchGame::where('match_id', $m->id)
            ->where(fn ($q) => $q->where('home_user_id', $userId)->orWhere('away_user_id', $userId))->first();
        if (! $game) {
            throw new TeamException('not_in_lineup', 403);
        }
        if ($game->status === 'finished') {
            throw new TeamException('game_over', 409);
        }
        $col = (int) $game->home_user_id === $userId ? 'ready_home_at' : 'ready_away_at';
        $game->update([$col => now()]);
        $game->refresh();
        if (now()->gte($m->scheduled_at) && $this->present($game, 'home', now()) && $this->present($game, 'away', now())) {
            return $this->allocateRoom($game); // iki taraf hazır → oda aç (eşzamanlı başlar)
        }

        return null;
    }

    /**
     * 5 dk hazır-olma penceresi kararı (tick) — başlangıç+5dk sonrası pending oyun:
     *  tek taraf hazır → diğeri hükmen (1-0, oda yok→rating yok); iki taraf da gelmedi → ½-½ (draw).
     */
    public function resolveGameReadyWindow(TeamMatch $m, TeamMatchGame $game, ?Carbon $now = null): ?string
    {
        $now = $now ? $now->copy() : now();
        if ($game->status === 'finished') {
            return null;
        }
        if (! $m->scheduled_at || $now->lt($m->scheduled_at->copy()->addMinutes(TeamRules::READY_WINDOW_MINUTES))) {
            return null;
        }
        if ($game->room_code) {
            $room = Room::where('code', $game->room_code)->first();
            if ($room && in_array($room->status, ['playing', 'finished'], true)) {
                return null; // oda başladı → oda otoriter, karışma
            }
        }
        $h = $this->present($game, 'home', $now);
        $a = $this->present($game, 'away', $now);
        if ($h && $a) {
            return null; // ikisi de orada → markReady odayı açar
        }
        if ($h !== $a) {
            $result = $h ? 'home' : 'away';
            $winnerId = $h ? (int) $game->home_user_id : (int) $game->away_user_id;
            $game->update(['status' => 'finished', 'result' => $result, 'winner_user_id' => $winnerId, 'finished_at' => $now]);
            $this->tryFinalize((int) $m->id);

            return $result;
        }
        // İki taraf da gelmedi → ½-½ (oynanmadı; oda yok → rating yok).
        $game->update(['status' => 'finished', 'result' => 'draw', 'winner_user_id' => null, 'finished_at' => $now]);
        $this->tryFinalize((int) $m->id);

        return 'draw';
    }

    /** Oda otoriter sonucunu yakala (tick + istek anı). Koltuk-guard: oda oyuncuları eşleşmeyle aynı mı. */
    public function captureGameResult(TeamMatchGame $game): bool
    {
        if ($game->status === 'finished' || ! $game->room_code) {
            return false;
        }
        $room = Room::where('code', $game->room_code)->first();
        if (! $room || $room->bot || ! $room->hasVerifiedServerResult()) {
            return false;
        }
        $players = [(int) $game->home_user_id, (int) $game->away_user_id];
        $seats = [(int) $room->p1_user_id, (int) $room->p2_user_id];
        sort($players);
        sort($seats);
        if ($players[0] <= 0 || $players[0] === $players[1] || $players !== $seats) {
            return false;
        }
        $winnerId = ($room->server_match['winner'] ?? null) === 'white'
            ? (int) $room->p1_user_id : (int) $room->p2_user_id;
        $game->update([
            'status' => 'finished',
            'result' => $winnerId === (int) $game->home_user_id ? 'home' : 'away',
            'winner_user_id' => $winnerId, 'finished_at' => now(),
        ]);
        $this->tryFinalize((int) $game->match_id);

        return true;
    }

    /** Beş oyun da bittiyse takım skorunu/sonucunu hesapla + kesinleştir (§9). İdempotent. */
    public function tryFinalize(int $matchId): void
    {
        $done = false;
        DB::transaction(function () use ($matchId, &$done) {
            $m = TeamMatch::query()->lockForUpdate()->find($matchId);
            if (! $m || ! in_array($m->status, ['scheduled', 'live'], true) || ! $m->lineup_locked_at) {
                return;
            }
            $games = TeamMatchGame::where('match_id', $m->id)->get();
            if ($games->isEmpty() || $games->contains(fn ($g) => $g->status !== 'finished')) {
                return; // başlayan diğer maçlar bitene kadar bekle (§9: 3 galibiyet garantilese bile)
            }
            $home = 0.0;
            $away = 0.0;
            $allDraw = true;
            foreach ($games as $g) {
                if ($g->result === 'home') {
                    $home += 1;
                    $allDraw = false;
                } elseif ($g->result === 'away') {
                    $away += 1;
                    $allDraw = false;
                } elseif ($g->result === 'draw') {
                    $home += 0.5;
                    $away += 0.5;
                }
            }
            if ($allDraw) {
                // İki takımın TÜM oyuncuları gelmedi → çift hükmen (iki tarafa 0, beraberlik DEĞİL §9).
                $m->update(['status' => 'finished', 'finished_at' => now(), 'home_score' => 0, 'away_score' => 0, 'result' => 'double_forfeit']);
            } else {
                $res = $home > $away ? 'home_win' : ($away > $home ? 'away_win' : 'draw');
                $m->update(['status' => 'finished', 'finished_at' => now(), 'home_score' => $home, 'away_score' => $away, 'result' => $res]);
            }
            $done = true;
        });
        if ($done) {
            $this->afterFinalize(TeamMatch::find($matchId));
        }
    }

    // ---- Yardımcılar -------------------------------------------------------

    private function afterFinalize(TeamMatch $m): void
    {
        // Bireysel rating oda settlement'ında oturdu → takım ortalamalarını güncelle (§6).
        foreach ([(int) $m->home_team_id, (int) $m->away_team_id] as $tid) {
            $t = Team::find($tid);
            if ($t && $t->status === 'active') {
                $this->teams->recompute($t);
            }
        }
        TeamNotifier::fire($m->id, 'team_match_result', $m->finished_at ?? now(), $this->matchRecipients($m),
            'Karşılaşma sonucu', 'Takım karşılaşman sonuçlandı. Skoru takım sayfandan gör.');
    }

    private function validLineup(TeamMatch $m, int $teamId): array
    {
        $out = [];
        foreach (TeamMatchLineup::where('match_id', $m->id)->where('team_id', $teamId)->orderBy('slot')->get() as $r) {
            if (! TeamMember::where('team_id', $teamId)->where('user_id', $r->user_id)->exists()) {
                continue; // kilit sonrası ayrıldı/çıkarıldı
            }
            $u = User::find($r->user_id);
            if (! $u || ! $this->teams->isPremium($u)) {
                continue; // başlangıçta aktif Premium şart (7 günlük süre oynatmaz — §8)
            }
            $out[] = (int) $r->user_id;
        }

        return $out;
    }

    private function present(TeamMatchGame $game, string $side, Carbon $now): bool
    {
        $t = $side === 'home' ? $game->ready_home_at : $game->ready_away_at;

        return $t !== null && Carbon::parse($t)->gte($now->copy()->subSeconds(self::PRESENCE_SEC));
    }

    private function allocateRoom(TeamMatchGame $game): string
    {
        if ($game->room_code) {
            $old = Room::where('code', $game->room_code)->first();
            if (! $old || $old->status !== 'finished' || $old->hasVerifiedServerResult()) {
                $this->cacheRoom($game);

                return $game->room_code;
            }
        }
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $code = '';
            for ($i = 0; $i < 5; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (Room::where('code', $code)->exists());
        $game->update(['room_code' => $code, 'status' => 'live', 'started_at' => now()]);
        $this->cacheRoom($game);

        return $code;
    }

    private function cacheRoom(TeamMatchGame $game): void
    {
        $code = $game->room_code;
        // League/turnuva ile AYNI sözleşme: target dolu + mode yok → oda PUANLI; players → koltuk yetkisi.
        Cache::put(TournamentController::roomTargetKey($code), TeamRules::GAME_POINTS, now()->addDays(2));
        Cache::put(TournamentController::roomPlayersKey($code), [(int) $game->home_user_id, (int) $game->away_user_id], now()->addDays(2));
    }

    private function actorTeam(TeamMatch $m, int $actorId): Team
    {
        foreach ([(int) $m->home_team_id, (int) $m->away_team_id] as $tid) {
            $mem = TeamMember::where('team_id', $tid)->where('user_id', $actorId)->first();
            if ($mem && $mem->isManager()) {
                return Team::findOrFail($tid);
            }
        }
        throw new TeamException('not_a_manager', 403);
    }

    private function activeMatchCount(int $teamId): int
    {
        return TeamMatch::where(fn ($q) => $q->where('home_team_id', $teamId)->orWhere('away_team_id', $teamId))
            ->whereIn('status', ['scheduled', 'live'])->count();
    }

    /** Aynı takımın başka onaylı maçıyla saat çakışması (±3 saatlik kaba pencere). */
    private function hasTimeConflict(int $teamId, Carbon $at, int $excludeId): bool
    {
        // ponytail: ±3 saat kaba çakışma penceresi; maç+hazırlık süresini kapsar, ince ayar gerekirse daraltılır.
        return TeamMatch::where('id', '!=', $excludeId)
            ->where(fn ($q) => $q->where('home_team_id', $teamId)->orWhere('away_team_id', $teamId))
            ->whereIn('status', ['scheduled', 'live'])
            ->whereBetween('scheduled_at', [$at->copy()->subHours(3), $at->copy()->addHours(3)])
            ->exists();
    }

    /** Aynı çift: açık (proposed/scheduled/live) mükerrer maç VEYA son sonuçlanmadan 72s geçmedi. */
    private function rematchBlocked(int $a, int $b, int $excludeId): bool
    {
        $open = TeamMatch::betweenPair($a, $b)->where('id', '!=', $excludeId)
            ->whereIn('status', ['scheduled', 'live'])->exists();
        if ($open) {
            return true;
        }
        $last = TeamMatch::betweenPair($a, $b)->where('status', 'finished')
            ->whereNotNull('finished_at')->latest('finished_at')->first();

        return $last && $last->finished_at->gt(now()->subHours(TeamRules::REMATCH_COOLDOWN_HOURS));
    }

    /** @return list<int> */
    private function teamManagers(int $teamId): array
    {
        return TeamMember::where('team_id', $teamId)->whereIn('role', ['founder', 'assistant'])
            ->pluck('user_id')->map(fn ($x) => (int) $x)->all();
    }

    /** Karşılaşma bildirimi alıcıları: iki takımın yöneticileri + açıklanmış kadro oyuncuları. @return list<int> */
    private function matchRecipients(TeamMatch $m): array
    {
        $managers = TeamMember::whereIn('team_id', [(int) $m->home_team_id, (int) $m->away_team_id])
            ->whereIn('role', ['founder', 'assistant'])->pluck('user_id')->map(fn ($x) => (int) $x)->all();
        $players = TeamMatchLineup::where('match_id', $m->id)->pluck('user_id')->map(fn ($x) => (int) $x)->all();

        return array_values(array_unique(array_merge($managers, $players)));
    }
}
