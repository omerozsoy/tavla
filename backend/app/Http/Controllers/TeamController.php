<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\TeamApplication;
use App\Models\TeamAudit;
use App\Models\TeamInvite;
use App\Models\TeamMatch;
use App\Models\TeamMatchGame;
use App\Models\TeamMatchLineup;
use App\Models\TeamMember;
use App\Models\TeamMessage;
use App\Models\User;
use App\Support\AvatarStore;
use App\Support\ChatModeration;
use App\Support\TeamLeague\TeamException;
use App\Support\TeamLeague\TeamMatchRuntime;
use App\Support\TeamLeague\TeamRules;
use App\Support\TeamLeague\TeamService;
use App\Support\TeamLeague\TeamStandings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Takımlar Ligi API. Sıralama/arama/detay/karşılaşma sayfası HERKESE AÇIK; üyelik/yönetim/maç akışı
 * yalnız ilgili kullanıcı (sunucu-otoriter — TÜM kural TeamService/TeamMatchRuntime'da). Admin uçları
 * hem route ('admin' mw) hem burada is_admin ile korunur (savunma-derinliği). Kişisel bilgi (e-posta)
 * sızmaz; GİZLİ KADRO kilide kadar rakibe/herkese AÇILMAZ (serileştirme gate'i).
 */
class TeamController extends Controller
{
    public function __construct(private TeamService $svc, private TeamMatchRuntime $rt) {}

    // ---- Herkese açık --------------------------------------------------------

    /** Genel bakış + arama: ana sıralama (ilk N) + ada/etikete göre arama. */
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            $key = TeamService::keyify($q);
            $teams = Team::where('status', 'active')
                ->where(fn ($w) => $w->where('name_key', 'like', '%'.$key.'%')->orWhere('tag_key', 'like', '%'.$key.'%'))
                ->orderByDesc('rating_avg')->limit(30)->get();

            return response()->json(['results' => $teams->map(fn ($t) => $this->teamBrief($t))->all()]);
        }
        $table = app(TeamStandings::class)->mainTable();

        return response()->json([
            'ranking' => array_map(fn ($r) => array_merge($this->teamBrief($r['team']), [
                'rank' => $r['rank'], 'rating_avg' => round($r['avg'], 1), 'member_count' => $r['members'],
            ]), array_slice($table, 0, 100)),
            'rules' => $this->rulesPayload(),
        ]);
    }

    /** Aylık meydan okuma sıralaması + geçmiş aylar listesi. */
    public function monthly(Request $request): JsonResponse
    {
        $month = (string) $request->query('month', now()->format('Y-m'));
        $rows = app(TeamStandings::class)->monthlyTable($month);
        $teams = Team::whereIn('id', array_map(fn ($r) => $r['team_id'], $rows))->get()->keyBy('id');
        $months = TeamMatch::where('status', 'finished')->whereNotNull('month_key')
            ->distinct()->orderByDesc('month_key')->limit(24)->pluck('month_key')->all();

        return response()->json([
            'month' => $month,
            'past_months' => $months,
            'table' => array_map(fn ($r) => [
                'rank' => $r['rank'], 'team' => isset($teams[$r['team_id']]) ? $this->teamBrief($teams[$r['team_id']]) : null,
                'points' => $r['pts'], 'match_diff' => $r['diff'], 'team_wins' => $r['wins'], 'played' => $r['played'],
            ], $rows),
        ]);
    }

    public function show(Team $team): JsonResponse
    {
        $members = TeamMember::where('team_id', $team->id)->get();
        $users = $this->userMap($members->pluck('user_id')->all());
        $roleRank = ['founder' => 0, 'assistant' => 1, 'member' => 2];

        return response()->json([
            'team' => array_merge($this->teamBrief($team), [
                'description' => $team->description,
                'applications_open' => (bool) $team->applications_open,
                'min_apply_rating' => $team->min_apply_rating,
                'awards' => $team->awards()->orderByDesc('month_key')->get()
                    ->map(fn ($a) => ['month_key' => $a->month_key, 'rank' => $a->rank, 'kind' => $a->kind])->all(),
            ]),
            'members' => $members->sortBy(fn ($m) => $roleRank[$m->role] ?? 9)->values()->map(fn ($m) => [
                'role' => $m->role, 'user' => $users[$m->user_id] ?? ['id' => $m->user_id],
                'premium_grace_until' => $m->premium_grace_until?->toIso8601String(),
            ])->all(),
            'matches' => TeamMatch::betweenPair($team->id, $team->id)->orWhere('home_team_id', $team->id)
                ->orWhere('away_team_id', $team->id)->orderByDesc('scheduled_at')->limit(20)->get()
                ->map(fn ($m) => $this->matchPublic($m))->all(),
        ]);
    }

    /** Herkese açık karşılaşma sayfası (§11): takımlar/renk/logo, açıklanmış kadro, skorlar, izleme linkleri. */
    public function matchShow(TeamMatch $match): JsonResponse
    {
        return response()->json(['match' => $this->matchPublic($match)]);
    }

    /**
     * Site geneli takım etiketi haritası (userId → tag) — isim yanında [ETİKET] göstermek için (§2).
     * /roles ile aynı desen: tek harita, frontend her isim-render noktasında overlay eder. 60s cache.
     * ponytail: tüm aktif üyeleri döndürür; üye sayısı çok büyürse per-görünür-set'e daraltılır.
     */
    public function tags(): JsonResponse
    {
        $tags = Cache::remember('team_tags_v3', 60, fn () => TeamMember::query()
            ->join('teams', 'teams.id', '=', 'team_members.team_id')
            ->where('teams.status', 'active')
            ->get(['team_members.user_id', 'teams.name', 'teams.tag', 'teams.logo', 'teams.color1', 'teams.color2'])
            ->keyBy('user_id')
            ->map(fn ($r) => [
                'tag' => $r->tag,
                'name' => $r->name, // amblem hover tooltip'i (tam takım adı)
                'logo' => $r->logo, // onaylı logo (/uploads/... veya null) — kalkana kırpılır
                'color1' => $r->color1,
                'color2' => $r->color2,
            ])
            ->all());

        return response()->json(['tags' => $tags]);
    }

    // ---- Kullanıcı (auth) ----------------------------------------------------

    public function me(Request $request): JsonResponse
    {
        $u = $request->user();
        $m = TeamMember::where('user_id', $u->id)->first();
        $cooldown = $u->is_admin ? null : $this->svc->cooldownUntil((int) $u->id); // yönetici bekleme süresinden muaf
        $rated = $this->svc->ratedMatchCount($u);
        $premium = $this->svc->isPremium($u);

        // Yönetici ise takımına gelen bekleyen başvurular (kabul/ret için) + GÖNDERDİĞİ bekleyen
        // davetler ("davet edildi, cevap bekleniyor" olarak göstermek için).
        $managed = null;
        if ($m && $m->isManager()) {
            $apps = TeamApplication::where('team_id', $m->team_id)->where('status', 'pending')->get();
            $sent = TeamInvite::where('team_id', $m->team_id)->where('status', 'pending')->get();
            $umap = $this->userMap(array_merge($apps->pluck('user_id')->all(), $sent->pluck('user_id')->all()));
            $managed = [
                'team_id' => $m->team_id,
                'applications' => $apps->map(fn ($a) => ['id' => $a->id, 'user' => $umap[$a->user_id] ?? ['id' => $a->user_id]])->all(),
                'sent_invites' => $sent->map(fn ($i) => ['id' => $i->id, 'user' => $umap[$i->user_id] ?? ['id' => $i->user_id]])->all(),
            ];
        }
        // Bana yapılmış kuruculuk devri teklifi (varsa) → "Kuruculuğu Kabul Et".
        $transferOffer = Team::where('pending_transfer_to', $u->id)->value('id');

        return response()->json([
            'membership' => $m ? [
                'team' => $this->teamBrief(Team::find($m->team_id)), 'role' => $m->role,
                'premium_grace_until' => $m->premium_grace_until?->toIso8601String(),
            ] : null,
            'managed' => $managed,
            'transfer_offer' => $transferOffer ? (int) $transferOffer : null,
            'applications' => TeamApplication::where('user_id', $u->id)->where('status', 'pending')->get()
                ->map(fn ($a) => ['id' => $a->id, 'team' => $this->teamBrief(Team::find($a->team_id))])->all(),
            'invites' => TeamInvite::where('user_id', $u->id)->where('status', 'pending')->get()
                ->map(fn ($i) => ['id' => $i->id, 'team' => $this->teamBrief(Team::find($i->team_id))])->all(),
            'eligibility' => [
                'premium' => $premium, 'rated_matches' => $rated, 'min_rated' => TeamRules::MIN_RATED_MATCHES,
                'cooldown_until' => $cooldown?->toIso8601String(),
                'can_create' => $premium && $rated >= TeamRules::MIN_RATED_MATCHES && ! $m && ! $cooldown,
                'found_cost' => TeamRules::FOUND_COST,
            ],
        ]);
    }

    public function create(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:40'],
            'tag' => ['required', 'string', 'max:10'],
            'color1' => ['nullable', 'string', 'max:9'],
            'color2' => ['nullable', 'string', 'max:9'],
            'description' => ['nullable', 'string', 'max:500'],
            'logo' => ['nullable', 'string', 'max:255'], // hazır logo kimliği/URL'si
            'logo_upload' => ['sometimes', 'nullable', 'string'], // base64 yüklenen görsel
        ]);

        // Yüklenen logo: base64 → 128² WebP URL (AvatarStore). Admin onayına kadar logo_pending'e yazılır
        // (herkese açıkta GÖSTERİLMEZ); kuruluşta görünen kimlik renk/tag amblemidir.
        if (! empty($data['logo_upload'])) {
            $data['logo_pending'] = AvatarStore::store($data['logo_upload']);
        }
        unset($data['logo_upload']);

        return $this->guard(fn () => response()->json([
            'team' => $this->teamBrief($this->svc->createTeam($request->user(), $data)),
        ], 201));
    }

    public function updateIdentity(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate([
            'color1' => ['sometimes', 'string', 'max:9'],
            'color2' => ['sometimes', 'string', 'max:9'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'logo_preset' => ['sometimes', 'string', 'max:255'],   // hazır logo → anında
            'logo_pending' => ['sometimes', 'nullable', 'string', 'max:255'], // yüklenen → admin onayı
            'logo_upload' => ['sometimes', 'nullable', 'string'],  // base64 yüklenen görsel → logo_pending
            'applications_open' => ['sometimes', 'boolean'],
            'min_apply_rating' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:4000'],
        ]);

        // Yüklenen logo: base64 → WebP URL, admin onayına kadar logo_pending.
        if (! empty($data['logo_upload'])) {
            $data['logo_pending'] = AvatarStore::store($data['logo_upload']);
        }
        unset($data['logo_upload']);

        return $this->guard(fn () => response()->json([
            'team' => $this->teamBrief($this->svc->updateIdentity($request->user(), $team, $data)),
        ]));
    }

    public function rename(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:40'],
            'tag' => ['nullable', 'string', 'max:10'],
        ]);

        return $this->guard(fn () => response()->json([
            'team' => $this->teamBrief($this->svc->rename($team, $request->user(), $data['name'] ?? null, $data['tag'] ?? null)),
        ]));
    }

    public function apply(Request $request, Team $team): JsonResponse
    {
        return $this->guard(fn () => response()->json(['id' => $this->svc->apply($request->user(), $team)->id]));
    }

    public function cancelApplication(Request $request, TeamApplication $application): JsonResponse
    {
        return $this->guard(function () use ($request, $application) {
            $this->svc->cancelApplication($request->user(), $application);

            return response()->json(['ok' => true]);
        });
    }

    public function decideApplication(Request $request, TeamApplication $application): JsonResponse
    {
        $data = $request->validate(['accept' => ['required', 'boolean']]);

        return $this->guard(function () use ($request, $application, $data) {
            $this->svc->decideApplication($request->user(), $application, (bool) $data['accept']);

            return response()->json(['ok' => true]);
        });
    }

    public function invite(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer']]);

        return $this->guard(fn () => response()->json([
            'id' => $this->svc->invite($request->user(), $team, (int) $data['user_id'])->id,
        ]));
    }

    public function acceptInvite(Request $request, TeamInvite $invite): JsonResponse
    {
        return $this->guard(function () use ($request, $invite) {
            $this->svc->acceptInvite($request->user(), $invite);

            return response()->json(['ok' => true]);
        });
    }

    public function declineInvite(Request $request, TeamInvite $invite): JsonResponse
    {
        return $this->guard(function () use ($request, $invite) {
            $this->svc->declineInvite($request->user(), $invite);

            return response()->json(['ok' => true]);
        });
    }

    public function revokeInvite(Request $request, TeamInvite $invite): JsonResponse
    {
        return $this->guard(function () use ($request, $invite) {
            $this->svc->revokeInvite($request->user(), $invite);

            return response()->json(['ok' => true]);
        });
    }

    public function leave(Request $request): JsonResponse
    {
        return $this->guard(function () use ($request) {
            $this->svc->leave($request->user());

            return response()->json(['ok' => true]);
        });
    }

    public function kick(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer']]);

        return $this->guard(function () use ($request, $team, $data) {
            $this->svc->kick($request->user(), $team, (int) $data['user_id']);

            return response()->json(['ok' => true]);
        });
    }

    public function promote(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer']]);

        return $this->guard(function () use ($request, $team, $data) {
            $this->svc->promoteAssistant($request->user(), $team, (int) $data['user_id']);

            return response()->json(['ok' => true]);
        });
    }

    public function demote(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer']]);

        return $this->guard(function () use ($request, $team, $data) {
            $this->svc->demoteAssistant($request->user(), $team, (int) $data['user_id']);

            return response()->json(['ok' => true]);
        });
    }

    public function transfer(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer']]);

        return $this->guard(function () use ($request, $team, $data) {
            $this->svc->proposeTransfer($request->user(), $team, (int) $data['user_id']);

            return response()->json(['ok' => true]);
        });
    }

    public function acceptTransfer(Request $request, Team $team): JsonResponse
    {
        return $this->guard(function () use ($request, $team) {
            $this->svc->acceptTransfer($request->user(), $team);

            return response()->json(['ok' => true]);
        });
    }

    public function close(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate(['confirm' => ['required', 'boolean']]);

        return $this->guard(function () use ($request, $team, $data) {
            $this->svc->closeTeam($request->user(), $team, (bool) $data['confirm']);

            return response()->json(['ok' => true]);
        });
    }

    /** Yönetim işlem geçmişi (kurucu + yardımcılar — kendi takımları). */
    public function audits(Request $request, Team $team): JsonResponse
    {
        if (! $this->isManager($team, (int) $request->user()->id)) {
            return response()->json(['error' => 'not_a_manager'], 403);
        }

        return response()->json([
            'audits' => TeamAudit::where('team_id', $team->id)->orderByDesc('id')->limit(100)->get()
                ->map(fn ($a) => [
                    'action' => $a->action, 'actor_id' => $a->actor_id, 'target_user_id' => $a->target_user_id,
                    'meta' => $a->meta, 'at' => $a->created_at?->toIso8601String(),
                ])->all(),
        ]);
    }

    // ---- Sohbet (§11) --------------------------------------------------------

    public function chatList(Request $request, Team $team): JsonResponse
    {
        if (! TeamMember::where('team_id', $team->id)->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['error' => 'not_a_member'], 403); // üyelik bitince geçmişe de erişim yok
        }

        return response()->json([
            'messages' => TeamMessage::where('team_id', $team->id)->orderByDesc('pinned')->orderByDesc('id')
                ->limit(100)->get()->map(fn ($m) => $this->messagePayload($m))->all(),
        ]);
    }

    public function chatPost(Request $request, Team $team): JsonResponse
    {
        $u = $request->user();
        if (! TeamMember::where('team_id', $team->id)->where('user_id', $u->id)->exists()) {
            return response()->json(['error' => 'not_a_member'], 403);
        }
        if (($left = ChatModeration::mutedSeconds($u)) !== null) {
            return response()->json(['error' => 'muted', 'muted_seconds' => $left], 403);
        }
        $data = $request->validate(['body' => ['required', 'string', 'max:1000']]);
        [$clean, $hit, $word] = ChatModeration::filter($data['body'], $u); // mevcut küfür filtresi (§11)
        if ($hit) {
            ChatModeration::penalize($u, $word);
        }
        $msg = TeamMessage::create(['team_id' => $team->id, 'user_id' => $u->id, 'body' => $clean]);

        return response()->json(['message' => $this->messagePayload($msg->fresh())]);
    }

    public function pinMessage(Request $request, TeamMessage $message): JsonResponse
    {
        $team = Team::find($message->team_id);
        if (! $team || ! $this->isManager($team, (int) $request->user()->id)) {
            return response()->json(['error' => 'not_a_manager'], 403);
        }
        $data = $request->validate(['pinned' => ['required', 'boolean']]);
        $message->update(['pinned' => (bool) $data['pinned']]);

        return response()->json(['ok' => true]);
    }

    // ---- Karşılaşma akışı (§7-§9) -------------------------------------------

    public function challenge(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate([
            'opponent_team_id' => ['required', 'integer'],
            'at' => ['required', 'date'],
        ]);

        return $this->guard(function () use ($request, $team, $data) {
            $opp = Team::findOrFail((int) $data['opponent_team_id']);
            $m = $this->rt->proposeMatch($team, $opp, Carbon::parse($data['at']), (int) $request->user()->id);

            return response()->json(['id' => $m->id], 201);
        });
    }

    public function acceptMatch(Request $request, TeamMatch $match): JsonResponse
    {
        return $this->guard(function () use ($request, $match) {
            $this->rt->acceptMatch($match, (int) $request->user()->id);

            return response()->json(['ok' => true]);
        });
    }

    public function rescheduleMatch(Request $request, TeamMatch $match): JsonResponse
    {
        $data = $request->validate(['at' => ['required', 'date']]);

        return $this->guard(function () use ($request, $match, $data) {
            $this->rt->reschedule($match, (int) $request->user()->id, Carbon::parse($data['at']));

            return response()->json(['ok' => true]);
        });
    }

    public function cancelMatch(Request $request, TeamMatch $match): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:160']]);

        return $this->guard(fn () => response()->json([
            'status' => $this->rt->cancelMatch($match, (int) $request->user()->id, $data['reason'] ?? null),
        ]));
    }

    public function setLineup(Request $request, TeamMatch $match): JsonResponse
    {
        $data = $request->validate([
            'team_id' => ['required', 'integer'],
            'user_ids' => ['required', 'array', 'size:'.TeamRules::LINEUP_SIZE],
            'user_ids.*' => ['integer'],
        ]);

        return $this->guard(function () use ($request, $match, $data) {
            $this->rt->setLineup($match, (int) $data['team_id'], (int) $request->user()->id, $data['user_ids']);

            return response()->json(['ok' => true]);
        });
    }

    /** "Hazırım" (§9): iki taraf taze hazır + başlangıç geçtiyse oda kodu döner. */
    public function ready(Request $request, TeamMatch $match): JsonResponse
    {
        return $this->guard(fn () => response()->json([
            'ok' => true, 'room' => $this->rt->markReady($match, (int) $request->user()->id),
        ]));
    }

    /** Oyuncunun/yöneticinin karşılaşma görünümü: KENDİ kadrosu görünür; rakip kadro KİLİDE kadar gizli. */
    public function myMatch(Request $request, TeamMatch $match): JsonResponse
    {
        $uid = (int) $request->user()->id;
        $out = $this->matchPublic($match);
        $myTeamId = null;
        foreach ([(int) $match->home_team_id, (int) $match->away_team_id] as $tid) {
            if (TeamMember::where('team_id', $tid)->where('user_id', $uid)->exists()) {
                $myTeamId = $tid;
                break;
            }
        }
        if ($myTeamId) {
            $out['my_team_id'] = $myTeamId;
            // KENDİ kadrosu her zaman görünür (rakibinki matchPublic'te yalnız kilit sonrası gelir).
            $out['my_lineup'] = $this->lineupPayload($match, $myTeamId);
            $g = TeamMatchGame::where('match_id', $match->id)
                ->where(fn ($q) => $q->where('home_user_id', $uid)->orWhere('away_user_id', $uid))->first();
            $out['my_game'] = $g ? [
                'slot' => $g->slot, 'status' => $g->status, 'result' => $g->result,
                'room_code' => $g->room_code,
                'ready_home' => $this->fresh($g->ready_home_at), 'ready_away' => $this->fresh($g->ready_away_at),
            ] : null;
        }

        return response()->json(['match' => $out]);
    }

    // ---- Admin (§12) ---------------------------------------------------------

    public function adminIndex(Request $request): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $q = trim((string) $request->query('q', ''));
        $teams = Team::query()
            ->when($q !== '', fn ($w) => $w->where('name', 'like', '%'.$q.'%')->orWhere('tag', 'like', '%'.$q.'%'))
            ->orderByDesc('id')->limit(50)->get();

        return response()->json([
            'teams' => $teams->map(fn ($t) => array_merge($this->teamBrief($t), [
                'status' => $t->status, 'member_count' => $t->member_count,
                'logo_pending' => $t->logo_pending, 'founder_id' => $t->founder_id,
            ]))->all(),
        ]);
    }

    public function approveLogo(Request $request, Team $team): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $this->svc->approveLogo($team, (int) $request->user()->id);

        return response()->json(['ok' => true]);
    }

    public function rejectLogo(Request $request, Team $team): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $this->svc->rejectLogo($team, (int) $request->user()->id);

        return response()->json(['ok' => true]);
    }

    public function adminCancelMatch(Request $request, TeamMatch $match): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate(['reason' => ['required', 'string', 'max:160']]);

        return $this->guard(function () use ($request, $match, $data) {
            $this->rt->adminCancel($match, (int) $request->user()->id, $data['reason']);

            return response()->json(['ok' => true]);
        });
    }

    public function adminCorrectMatch(Request $request, TeamMatch $match): JsonResponse
    {
        if ($d = $this->denyNonAdmin($request)) {
            return $d;
        }
        $data = $request->validate([
            'result' => ['required', 'in:home_win,away_win,draw,double_forfeit'],
            'home_score' => ['required', 'numeric', 'min:0', 'max:5'],
            'away_score' => ['required', 'numeric', 'min:0', 'max:5'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        return $this->guard(function () use ($request, $match, $data) {
            $this->rt->adminCorrectResult($match, $data, (int) $request->user()->id, $data['reason']);

            return response()->json(['ok' => true]);
        });
    }

    // ---- Serileştirme --------------------------------------------------------

    private function teamBrief(?Team $t): ?array
    {
        if (! $t) {
            return null;
        }

        return [
            'id' => $t->id, 'name' => $t->name, 'tag' => $t->tag,
            'logo' => $t->logo, // YALNIZ onaylı logo; logo_pending herkese açıkta GÖSTERİLMEZ
            'color1' => $t->color1, 'color2' => $t->color2,
            'rating_avg' => round((float) $t->rating_avg, 1), 'member_count' => (int) $t->member_count,
            'is_champion' => $t->isChampionNow(),
            'status' => $t->status, // pending = yönetim onayında (frontend bilgilendirmesi)
        ];
    }

    private function matchPublic(TeamMatch $m): array
    {
        $revealed = $m->lineupRevealed();
        $out = [
            'id' => $m->id, 'status' => $m->status, 'result' => $m->result,
            'home' => $this->teamBrief(Team::find($m->home_team_id)),
            'away' => $this->teamBrief(Team::find($m->away_team_id)),
            'scheduled_at' => $m->scheduled_at?->toIso8601String(),
            'home_score' => (float) $m->home_score, 'away_score' => (float) $m->away_score,
            'month_key' => $m->month_key, 'lineup_revealed' => $revealed,
        ];
        if ($revealed) {
            // Kilit sonrası: kadrolar + oyunlar herkese açık (izleme linki = room_code).
            $users = $this->userMap(TeamMatchLineup::where('match_id', $m->id)->pluck('user_id')->all());
            $out['games'] = TeamMatchGame::where('match_id', $m->id)->orderBy('slot')->get()->map(fn ($g) => [
                'slot' => $g->slot, 'status' => $g->status, 'result' => $g->result,
                'home_user' => $users[$g->home_user_id] ?? null, 'away_user' => $users[$g->away_user_id] ?? null,
                'room_code' => $g->room_code, // izleme bağlantısı (mevcut izleme/gizlilik kuralları geçerli)
            ])->all();
        }

        return $out;
    }

    /** @return list<array<string,mixed>> */
    private function lineupPayload(TeamMatch $m, int $teamId): array
    {
        $rows = TeamMatchLineup::where('match_id', $m->id)->where('team_id', $teamId)->orderBy('slot')->get();
        $users = $this->userMap($rows->pluck('user_id')->all());

        return $rows->map(fn ($r) => ['slot' => $r->slot, 'user' => $users[$r->user_id] ?? ['id' => $r->user_id]])->all();
    }

    private function messagePayload(TeamMessage $m): array
    {
        $u = $m->user_id ? $this->userMap([$m->user_id])[$m->user_id] ?? null : null;

        return [
            'id' => $m->id, 'body' => $m->body, 'pinned' => (bool) $m->pinned,
            'user' => $u, 'at' => $m->created_at?->toIso8601String(),
        ];
    }

    private function rulesPayload(): array
    {
        return [
            'found_cost' => TeamRules::FOUND_COST, 'min_rated' => TeamRules::MIN_RATED_MATCHES,
            'capacity' => TeamRules::CAPACITY, 'max_assistants' => TeamRules::MAX_ASSISTANTS,
            'min_rank_members' => TeamRules::MIN_RANK_MEMBERS, 'lineup_size' => TeamRules::LINEUP_SIZE,
            'rename_cost' => TeamRules::RENAME_COST, 'cooldown_hours' => TeamRules::JOIN_COOLDOWN_HOURS,
            'points' => ['win' => TeamRules::PTS_WIN, 'draw' => TeamRules::PTS_DRAW, 'loss' => TeamRules::PTS_LOSS],
        ];
    }

    /** @return array<int,array{id:int,nickname:string,avatar:?string,rating:int,tag:?string}> (e-posta YOK). */
    private function userMap(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (empty($ids)) {
            return [];
        }
        // Takım etiketi: kullanıcı adının yanında göstermek için üyelik + takım tag'i (tek sorgu).
        $tags = TeamMember::whereIn('team_members.user_id', $ids)
            ->join('teams', 'teams.id', '=', 'team_members.team_id')
            ->pluck('teams.tag', 'team_members.user_id');

        return User::whereIn('id', $ids)->get(['id', 'nickname', 'avatar', 'rating'])
            ->keyBy('id')->map(fn ($u) => [
                'id' => $u->id, 'nickname' => $u->nickname, 'avatar' => $u->avatar,
                'rating' => (int) $u->rating, 'tag' => $tags[$u->id] ?? null,
            ])->all();
    }

    private function isManager(Team $team, int $userId): bool
    {
        $m = TeamMember::where('team_id', $team->id)->where('user_id', $userId)->first();

        return $m && $m->isManager();
    }

    private function fresh(?Carbon $t): bool
    {
        return $t !== null && $t->gte(now()->subSeconds(TeamMatchRuntime::PRESENCE_SEC));
    }

    private function denyNonAdmin(Request $request): ?JsonResponse
    {
        return $request->user()?->is_admin ? null : response()->json(['error' => 'admin_only'], 403);
    }

    /** TeamException → {error, status}; diğer kural ihlalleri (RuntimeException) → 422. */
    private function guard(callable $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (TeamException $e) {
            return response()->json(['error' => $e->errorCode], $e->status);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => 'rule_violation', 'message' => $e->getMessage()], 422);
        }
    }
}
