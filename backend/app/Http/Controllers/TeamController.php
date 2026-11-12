<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\TeamApplication;
use App\Models\TeamAudit;
use App\Models\TeamInvite;
use App\Models\TeamMember;
use App\Models\TeamMessage;
use App\Models\TeamSeasonChampion;
use App\Models\User;
use App\Support\AvatarStore;
use App\Support\ChatModeration;
use App\Support\TeamLeague\TeamException;
use App\Support\TeamLeague\TeamRules;
use App\Support\TeamLeague\TeamSeason;
use App\Support\TeamLeague\TeamService;
use App\Support\TeamLeague\TeamStandings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Takımlar Ligi API. Sıralama/arama/detay HERKESE AÇIK; üyelik/yönetim/bakiye akışı yalnız ilgili
 * kullanıcı (sunucu-otoriter — TÜM kural TeamService'te). Admin uçları hem route ('admin' mw) hem
 * burada is_admin ile korunur (savunma-derinliği). Kişisel bilgi (e-posta) sızmaz.
 * Takım rekabeti DÜELLO puanıyla yürür (5v5 TeamMatch sökülmüştür).
 */
class TeamController extends Controller
{
    public function __construct(private TeamService $svc) {}

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

    /** Geçmiş SEZON ŞAMPİYONLARI (rank 1), en yeni sezon üstte. Takım silinmişse adı korunur. */
    public function champions(): JsonResponse
    {
        $rows = TeamSeasonChampion::where('rank', 1)->orderByDesc('season_key')->limit(40)->get();
        $teams = Team::whereIn('id', $rows->pluck('team_id'))->get()->keyBy('id');

        return response()->json([
            'champions' => $rows->map(fn ($c) => [
                'season' => $c->season_key,
                'season_name' => TeamSeason::name($c->season_key),
                'team' => isset($teams[$c->team_id]) ? $this->teamBrief($teams[$c->team_id]) : null,
                'team_name' => $c->team_name,
                'points' => (int) $c->points,
            ])->all(),
        ]);
    }

    public function show(Request $request, Team $team): JsonResponse
    {
        $members = TeamMember::where('team_id', $team->id)->get();
        $users = $this->userMap($members->pluck('user_id')->all());
        $roleRank = ['founder' => 0, 'assistant' => 1, 'member' => 2];

        // Yöneticiye (kurucu/yardımcı) bekleyen logo bayrağı: gerçek logo_pending URL'i sızdırılmaz,
        // yalnız "onay bekliyor" bilgisi düzenleme formunda gösterilsin diye. Route public (auth
        // middleware YOK) + default guard 'web' Bearer'ı okumaz → sanctum guard'ını açıkça kullan.
        $viewer = $request->user('sanctum');
        $isManager = $viewer && $members->firstWhere(fn ($m) => $m->user_id === $viewer->id && in_array($m->role, ['founder', 'assistant'], true)) !== null;

        return response()->json([
            'team' => array_merge($this->teamBrief($team), [
                'description' => $team->description,
                'applications_open' => (bool) $team->applications_open,
                'min_apply_rating' => $team->min_apply_rating,
                'has_pending_logo' => $isManager && ! empty($team->logo_pending),
                'coin_balance' => (int) $team->coin_balance,       // ortak kasa (sezon ödülü + dağıtım)
                'can_grant' => $isManager,                          // kurucu/yardımcı → bakiyeden dağıtım UI'ı
                'awards' => TeamSeasonChampion::where('team_id', $team->id)->orderByDesc('season_key')->get()
                    ->map(fn ($c) => ['season' => $c->season_key, 'season_name' => TeamSeason::name($c->season_key), 'rank' => (int) $c->rank, 'points' => (int) $c->points])->all(),
            ]),
            'members' => $members->sortBy(fn ($m) => $roleRank[$m->role] ?? 9)->values()->map(fn ($m) => [
                'role' => $m->role, 'user' => $users[$m->user_id] ?? ['id' => $m->user_id],
                'premium_grace_until' => $m->premium_grace_until?->toIso8601String(),
            ])->all(),
        ]);
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
            // ANINDA devir (kullanıcı direktifi: "Devret" tıklanınca kurucu hemen değişsin; eski
            // iki-aşamalı teklif/kabul akışı kaldırıldı). Premium şartı doTransfer içinde korunur.
            $this->svc->transferFounder($request->user(), $team, (int) $data['user_id']);

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

    // ---- Takım bakiyesi (coin kasası) ---------------------------------------

    /** Kurucu/yardımcı bakiyeden bir ÜYEYE coin aktarır (kişisel cüzdana). Bakiye yetersizse 422. */
    public function grantCoins(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'amount' => ['required', 'integer', 'min:1', 'max:1000000'],
        ]);

        return $this->guard(function () use ($request, $team, $data) {
            $this->svc->grantFromBalance($team, (int) $request->user()->id, (int) $data['user_id'], (int) $data['amount']);

            return response()->json(['ok' => true, 'coin_balance' => (int) $team->fresh()->coin_balance]);
        });
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
