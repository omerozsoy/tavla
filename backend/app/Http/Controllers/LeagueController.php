<?php

namespace App\Http\Controllers;

use App\Models\LeagueMatch;
use App\Models\LeagueParticipant;
use App\Models\LeagueSeason;
use App\Models\User;
use App\Support\League\LeagueEngine;
use App\Support\League\LeagueRuntime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Türkiye Online Tavla Ligi API (§16/§17). Liste/detay/puan tablosu/fikstür/ağaç HERKESE AÇIK (misafir
 * dahil); başvuru/randevu/hazır-olma yalnız ilgili kullanıcı; sezon/seçim/kura/düzeltme yalnız ADMIN.
 * Yönetim uçları hem route ('admin' middleware) hem burada is_admin ile korunur (savunma-derinliği §13).
 * Herkese açık yanıtlarda e-posta gibi kişisel bilgi gösterilmez (§16).
 */
class LeagueController extends Controller
{
    // ---- Herkese açık --------------------------------------------------------

    /** Lig ana sayfası: aktif sezon özeti + biten sezonlar (şampiyonlarıyla). */
    public function index(): JsonResponse
    {
        $active = LeagueSeason::whereIn('status', LeagueSeason::ACTIVE_STATES)->orWhere('status', 'draft')
            ->orderByDesc('id')->first();
        $finished = LeagueSeason::where('status', 'finished')->orderByDesc('id')->limit(20)->get();

        return response()->json([
            'active' => $active ? $this->seasonSummary($active) : null,
            'finished' => $finished->map(fn ($s) => $this->seasonSummary($s))->all(),
        ]);
    }

    /** Sezon detayı: meta + puan tablosu + fikstür + ağaç + ödül + kurallar (açık). */
    public function show(LeagueSeason $season): JsonResponse
    {
        return response()->json([
            'season' => $this->seasonMeta($season),
            'standings' => $this->standingsPayload($season),
            'fixtures' => $this->fixturesPayload($season),
            'bracket' => $this->bracketPayload($season),
        ]);
    }

    public function standings(LeagueSeason $season): JsonResponse
    {
        return response()->json(['standings' => $this->standingsPayload($season)]);
    }

    public function fixtures(LeagueSeason $season): JsonResponse
    {
        return response()->json(['fixtures' => $this->fixturesPayload($season)]);
    }

    public function bracket(LeagueSeason $season): JsonResponse
    {
        return response()->json(['bracket' => $this->bracketPayload($season)]);
    }

    // ---- Kullanıcı (auth) ----------------------------------------------------

    public function apply(Request $request, LeagueSeason $season): JsonResponse
    {
        return $this->guard(fn () => LeagueRuntime::apply($season, $request->user())
            ? response()->json(['ok' => true]) : response()->json(['ok' => true]));
    }

    /** Kullanıcının durumu + sıradaki maçı (randevu/hazır-olma ekranı için). */
    public function me(Request $request, LeagueSeason $season): JsonResponse
    {
        $uid = (int) $request->user()->id;
        $p = LeagueParticipant::where('season_id', $season->id)->where('user_id', $uid)->first();
        $next = LeagueMatch::where('season_id', $season->id)->where('result', 'pending')
            ->where(fn ($q) => $q->where('p1_user_id', $uid)->orWhere('p2_user_id', $uid))
            ->orderBy('round')->first();

        return response()->json([
            'participation' => $p ? ['status' => $p->status, 'seed' => $p->seed, 'reserve_order' => $p->reserve_order] : null,
            'next_match' => $next ? $this->matchPayload($next, $season, $uid) : null,
        ]);
    }

    public function propose(Request $request, LeagueMatch $match): JsonResponse
    {
        $data = $request->validate(['at' => ['required', 'date']]);

        return $this->guard(function () use ($match, $request, $data) {
            LeagueRuntime::proposeAppointment($match, (int) $request->user()->id, $data['at']);

            return response()->json(['ok' => true]);
        });
    }

    public function confirm(Request $request, LeagueMatch $match): JsonResponse
    {
        return $this->guard(function () use ($match, $request) {
            LeagueRuntime::confirmAppointment($match, (int) $request->user()->id);

            return response()->json(['ok' => true]);
        });
    }

    /** "Hazırım" (§9): iki taraf taze hazırsa oda kodu döner (otomatik başlama). */
    public function ready(Request $request, LeagueMatch $match): JsonResponse
    {
        return $this->guard(function () use ($match, $request) {
            $code = LeagueRuntime::markReady($match, (int) $request->user()->id);

            return response()->json(['ok' => true, 'room' => $code]);
        });
    }

    /** Maç odası kodunu al/aç (§4): yalnız bu maçın oyuncusu. */
    public function room(Request $request, LeagueMatch $match): JsonResponse
    {
        $uid = (int) $request->user()->id;
        if ($uid !== (int) $match->p1_user_id && $uid !== (int) $match->p2_user_id) {
            return response()->json(['message' => 'Bu maçın oyuncusu değilsin.'], 403);
        }
        if ($match->result !== 'pending' || $match->p2_user_id === null) {
            return response()->json(['message' => 'Maç oynanabilir değil.'], 422);
        }

        return $this->guard(fn () => response()->json([
            'code' => LeagueRuntime::allocateRoom($match), 'target' => (int) $match->target,
        ]));
    }

    // ---- Admin (§13; route 'admin' middleware + burada is_admin) -------------

    public function create(Request $request): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'league_match_length' => ['nullable', 'integer', 'min:1', 'max:25'],
            'knockout_match_length' => ['nullable', 'integer', 'min:1', 'max:25'],
        ]);

        return $this->guard(fn () => response()->json([
            'season' => $this->seasonMeta(LeagueRuntime::createSeason(array_filter($data))),
        ]));
    }

    public function update(Request $request, LeagueSeason $season): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'league_match_length' => ['sometimes', 'integer', 'min:1', 'max:25'],
            'knockout_match_length' => ['sometimes', 'integer', 'min:1', 'max:25'],
            'prizes' => ['sometimes', 'array'],
            'tiebreak_manual' => ['sometimes', 'array'],
        ]);
        $season->update($data);

        return response()->json(['season' => $this->seasonMeta($season->refresh())]);
    }

    public function openApplications(Request $request, LeagueSeason $season): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate([
            'open_at' => ['nullable', 'date'],
            'close_at' => ['nullable', 'date'],
        ]);

        return $this->guard(fn () => response()->json([
            'season' => $this->seasonMeta(LeagueRuntime::openApplications($season, $data['open_at'] ?? null, $data['close_at'] ?? null)),
        ]));
    }

    public function decide(Request $request, LeagueSeason $season): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate([
            'selections' => ['required', 'array'],       // { userId: accepted|reserve|rejected|pending }
        ]);

        return $this->guard(function () use ($season, $data, $request) {
            LeagueRuntime::decide($season, $data['selections'], (int) $request->user()->id);

            return response()->json(['ok' => true]);
        });
    }

    public function start(Request $request, LeagueSeason $season): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }

        return $this->guard(fn () => response()->json(['season' => $this->seasonMeta(LeagueRuntime::startLeague($season))]));
    }

    public function draw(Request $request, LeagueSeason $season): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate([
            'mandatory_at' => ['nullable', 'date'],
            'deadline_at' => ['nullable', 'date'],
        ]);

        return $this->guard(function () use ($season, $data) {
            $round = LeagueRuntime::drawRound($season, $data['mandatory_at'] ?? null, $data['deadline_at'] ?? null);

            return response()->json(['ok' => true, 'round' => $round]);
        });
    }

    public function confirmLeague(Request $request, LeagueSeason $season): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }

        return $this->guard(fn () => response()->json(['season' => $this->seasonMeta(LeagueRuntime::confirmLeaguePhase($season))]));
    }

    public function buildKnockout(Request $request, LeagueSeason $season): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }

        return $this->guard(function () use ($season) {
            LeagueRuntime::buildKnockout($season);

            return response()->json(['ok' => true]);
        });
    }

    public function correct(Request $request, LeagueMatch $match): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate([
            'type' => ['required', 'in:played,p1_forfeit,p2_forfeit,double_noshow'],
            'winner_user_id' => ['nullable', 'integer'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        return $this->guard(function () use ($match, $data, $request) {
            LeagueRuntime::correctResult($match, $data['type'], $data['winner_user_id'] ?? null, (int) $request->user()->id, $data['reason']);

            return response()->json(['ok' => true]);
        });
    }

    public function postpone(Request $request, LeagueMatch $match): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate([
            'mandatory_at' => ['nullable', 'date'],
            'deadline_at' => ['nullable', 'date'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        return $this->guard(function () use ($match, $data, $request) {
            LeagueRuntime::postpone($match, $data['mandatory_at'] ?? null, $data['deadline_at'] ?? null, (int) $request->user()->id, $data['reason']);

            return response()->json(['ok' => true]);
        });
    }

    public function withdraw(Request $request, LeagueSeason $season): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate(['user_id' => ['required', 'integer']]);

        return $this->guard(function () use ($season, $data, $request) {
            LeagueRuntime::withdraw($season, (int) $data['user_id'], (int) $request->user()->id);

            return response()->json(['ok' => true]);
        });
    }

    // ---- Serileştirme (açık-güvenli) -----------------------------------------

    private function seasonSummary(LeagueSeason $s): array
    {
        $champ = null;
        if ($s->status === 'finished') {
            $f = LeagueMatch::where('season_id', $s->id)->where('phase', 'final')->first();
            $champ = $f?->winner_user_id ? $this->userBrief((int) $f->winner_user_id) : null;
        }

        return [
            'id' => $s->id, 'name' => $s->name, 'status' => $s->status,
            'current_round' => $s->current_round, 'rounds_total' => $s->rounds_total,
            'champion' => $champ,
        ];
    }

    private function seasonMeta(LeagueSeason $s): array
    {
        return array_merge($this->seasonSummary($s), [
            'league_match_length' => $s->league_match_length,
            'knockout_match_length' => $s->knockout_match_length,
            'applications_open_at' => $s->applications_open_at?->toIso8601String(),
            'applications_close_at' => $s->applications_close_at?->toIso8601String(),
            'prizes' => $s->prizes ?? [],
            'min_players' => LeagueSeason::MIN_PLAYERS,
            'max_players' => LeagueSeason::MAX_PLAYERS,
        ]);
    }

    /** Lig fazında canlı sıralama; dondurulduysa (knockout/finished) nihai sıralama. */
    private function standingsPayload(LeagueSeason $s): array
    {
        if (in_array($s->status, ['knockout', 'finished'], true) && is_array($s->standings_final)) {
            $rows = $s->standings_final['rows'] ?? [];
        } elseif ($s->status === 'league') {
            $rows = LeagueEngine::standings(LeagueRuntime::engineParticipants($s),
                is_array($s->tiebreak_manual) ? $s->tiebreak_manual : []);
        } else {
            return [];
        }
        $users = $this->userMap(array_map(fn ($r) => (int) $r['id'], $rows));

        return array_map(fn ($r) => [
            'rank' => $r['rank'] ?? null,
            'user' => $users[$r['id']] ?? ['id' => $r['id'], 'nickname' => $r['name'] ?? ''],
            'points' => $r['points'], 'wins' => $r['wins'], 'losses' => $r['losses'], 'byes' => $r['byes'],
            'opp_points' => $r['oppPoints'], 'beaten_points' => $r['beatenPoints'],
            'rating' => $r['rating'], 'status' => $r['status'],
        ], $rows);
    }

    private function fixturesPayload(LeagueSeason $s): array
    {
        $matches = LeagueMatch::where('season_id', $s->id)->where('phase', 'league')
            ->orderBy('round')->orderBy('bracket_pos')->get();
        $users = $this->userMap($matches->flatMap(fn ($m) => [(int) $m->p1_user_id, (int) $m->p2_user_id])->all());
        $byRound = [];
        foreach ($matches as $m) {
            $byRound[$m->round][] = $this->matchRow($m, $users);
        }
        ksort($byRound);

        return array_map(fn ($r, $ms) => ['round' => $r, 'matches' => $ms], array_keys($byRound), $byRound);
    }

    private function bracketPayload(LeagueSeason $s): array
    {
        $matches = LeagueMatch::where('season_id', $s->id)->whereIn('phase', ['prelim', 'r16', 'qf', 'sf', 'final'])
            ->orderBy('round')->orderBy('bracket_pos')->get();
        if ($matches->isEmpty()) {
            return [];
        }
        $users = $this->userMap($matches->flatMap(fn ($m) => [(int) $m->p1_user_id, (int) $m->p2_user_id])->all());
        $byPhase = [];
        foreach ($matches as $m) {
            $byPhase[$m->phase][] = array_merge($this->matchRow($m, $users), [
                'bracket_pos' => $m->bracket_pos,
                'p1_from' => $m->p1_from_match_id, 'p2_from' => $m->p2_from_match_id,
            ]);
        }

        return $byPhase;
    }

    private function matchRow(LeagueMatch $m, array $users): array
    {
        return [
            'id' => $m->id,
            'p1' => $m->p1_user_id ? ($users[(int) $m->p1_user_id] ?? null) : null,
            'p2' => $m->p2_user_id ? ($users[(int) $m->p2_user_id] ?? null) : null,
            'result' => $m->result,
            'winner_user_id' => $m->winner_user_id,
            'bye' => (bool) $m->bye,
            'mandatory_at' => $m->mandatory_at?->toIso8601String(),
            'deadline_at' => $m->deadline_at?->toIso8601String(),
            'start_at' => $m->effectiveStartAt()?->toIso8601String(),
            'room_code' => $m->room_code,
        ];
    }

    /** "my" maçı: ek olarak randevu + hazır-olma durumu (yalnız oyuncuya). */
    private function matchPayload(LeagueMatch $m, LeagueSeason $s, int $uid): array
    {
        $users = $this->userMap([(int) $m->p1_user_id, (int) $m->p2_user_id]);

        return array_merge($this->matchRow($m, $users), [
            'phase' => $m->phase, 'round' => $m->round, 'target' => $m->target,
            'appointment' => $m->appointment,
            'am_p1' => $uid === (int) $m->p1_user_id,
            'ready_p1' => $m->ready_p1_at?->toIso8601String(),
            'ready_p2' => $m->ready_p2_at?->toIso8601String(),
        ]);
    }

    /** @return array<int,array{id:int,nickname:string,avatar:?string,rating:int}> açık-güvenli (e-posta YOK). */
    private function userMap(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));
        if (empty($ids)) {
            return [];
        }

        return User::whereIn('id', $ids)->get(['id', 'nickname', 'avatar', 'rating'])
            ->keyBy('id')->map(fn ($u) => [
                'id' => $u->id, 'nickname' => $u->nickname, 'avatar' => $u->avatar, 'rating' => (int) $u->rating,
            ])->all();
    }

    private function userBrief(int $id): ?array
    {
        return $this->userMap([$id])[$id] ?? null;
    }

    private function denyNonAdmin(Request $request): ?JsonResponse
    {
        return $request->user()?->is_admin ? null : response()->json(['message' => 'Yalnızca yönetici.'], 403);
    }

    /** Runtime kural ihlallerini (RuntimeException) 422 + mesaj olarak döndür. */
    private function guard(callable $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
