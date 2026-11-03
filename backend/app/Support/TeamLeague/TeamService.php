<?php

namespace App\Support\TeamLeague;

use App\Models\MatchResult;
use App\Models\Notification;
use App\Models\Team;
use App\Models\TeamApplication;
use App\Models\TeamAudit;
use App\Models\TeamCooldown;
use App\Models\TeamInvite;
use App\Models\TeamMatch;
use App\Models\TeamMember;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Takımlar Ligi çekirdeği (turnuva/league_* modüllerinden bağımsız). TÜM yetki/kural/coin
 * kontrolleri burada (sunucu-otoriter). Controller yalnız request→method köprüsüdür.
 *
 * Yarış koruması: kapasite/çift-tık/çift-kesinti noktaları DB::transaction + lockForUpdate ile
 * serialize edilir; takım satırı → kullanıcı satırı kilit sırası tutarlı (deadlock önleme).
 */
class TeamService
{
    public function __construct(private WalletService $wallet) {}

    // ---- Yardımcılar -------------------------------------------------------

    /** Benzersizlik anahtarı: NFC + iç boşluk tekille + trim + lowercase (Unicode/case/boşluk duyarsız). */
    public static function keyify(string $s): string
    {
        $s = trim($s);
        if (class_exists(\Normalizer::class)) {
            $n = \Normalizer::normalize($s, \Normalizer::FORM_C);
            if ($n !== false) {
                $s = $n;
            }
        }
        $s = preg_replace('/\s+/u', ' ', $s) ?? $s;

        return mb_strtolower($s, 'UTF-8');
    }

    public function ratedMatchCount(User $u): int
    {
        return MatchResult::where('user_id', $u->id)->where('rated', true)->real()->count();
    }

    public function isPremium(User $u): bool
    {
        return $u->plan_active === 'premium';
    }

    public function membership(int $userId): ?TeamMember
    {
        return TeamMember::where('user_id', $userId)->first();
    }

    /** Aktif 72 saat yasağının bitişi (yoksa null). En geç biten kayıt bağlayıcı. */
    public function cooldownUntil(int $userId): ?Carbon
    {
        return TeamCooldown::where('user_id', $userId)
            ->where('until', '>', now())
            ->orderByDesc('until')
            ->value('until');
    }

    /** Katılım/kuruluş uygunluğu (§2/§4): Premium + ≥20 puanlı maç + başka takımda değil + bekleme yok. */
    public function assertCanJoin(User $u, ?int $minRating = null): void
    {
        if (! $this->isPremium($u)) {
            throw new TeamException('premium_required', 403);
        }
        if ($this->ratedMatchCount($u) < TeamRules::MIN_RATED_MATCHES) {
            throw new TeamException('not_enough_rated_matches', 403);
        }
        if (TeamMember::where('user_id', $u->id)->exists()) {
            throw new TeamException('already_in_team', 409);
        }
        if ($this->cooldownUntil($u->id)) {
            throw new TeamException('on_cooldown', 403);
        }
        if ($minRating !== null && (int) ($u->rating ?? 0) < $minRating) {
            throw new TeamException('rating_too_low', 403);
        }
    }

    private function validateName(string $name): void
    {
        $len = mb_strlen($name);
        if ($len < TeamRules::NAME_MIN || $len > TeamRules::NAME_MAX) {
            throw new TeamException('name_length', 422);
        }
    }

    private function validateTag(string $tag): void
    {
        if (! preg_match('/^[\p{L}\p{N}]{'.TeamRules::TAG_MIN.','.TeamRules::TAG_MAX.'}$/u', $tag)) {
            throw new TeamException('tag_format', 422);
        }
    }

    public function recompute(Team $team): void
    {
        $row = TeamMember::where('team_members.team_id', $team->id)
            ->join('users', 'users.id', '=', 'team_members.user_id')
            ->selectRaw('COUNT(*) as c, COALESCE(AVG(users.rating), 0) as avg')
            ->first();
        $team->member_count = (int) ($row->c ?? 0);
        $team->rating_avg = (float) ($row->avg ?? 0);
        $team->save();
    }

    private function audit(Team $team, ?int $actorId, string $action, ?int $targetUserId = null, array $meta = []): void
    {
        TeamAudit::create([
            'team_id' => $team->id,
            'actor_id' => $actorId,
            'action' => $action,
            'target_user_id' => $targetUserId,
            'meta' => $meta ?: null,
            'created_at' => now(),
        ]);
    }

    public function startCooldown(int $userId, string $reason, ?Carbon $now = null): void
    {
        $now = $now ? $now->copy() : now();
        TeamCooldown::create([
            'user_id' => $userId,
            'until' => $now->copy()->addHours(TeamRules::JOIN_COOLDOWN_HOURS),
            'reason' => $reason,
            'created_at' => $now,
        ]);
    }

    public function managerOrFail(Team $team, int $actorId, bool $founderOnly = false): TeamMember
    {
        $m = TeamMember::where('team_id', $team->id)->where('user_id', $actorId)->first();
        if (! $m || ! $m->isManager()) {
            throw new TeamException('not_a_manager', 403);
        }
        if ($founderOnly && $m->role !== 'founder') {
            throw new TeamException('founder_only', 403);
        }

        return $m;
    }

    private function addMember(Team $team, int $userId, string $role, ?int $appointedSeq = null): TeamMember
    {
        $m = TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $userId,
            'role' => $role,
            'appointed_seq' => $appointedSeq,
            'joined_at' => now(),
        ]);
        $this->recompute($team);

        return $m;
    }

    /** Katılım sonrası: diğer açık başvurular kapanır, bekleyen davetler geçersizleşir (§4). */
    private function invalidateOtherPending(int $userId, int $joinedTeamId): void
    {
        TeamApplication::where('user_id', $userId)
            ->where('status', 'pending')
            ->where('team_id', '!=', $joinedTeamId)
            ->update(['status' => 'cancelled', 'decided_at' => now()]);
        TeamInvite::where('user_id', $userId)
            ->where('status', 'pending')
            ->update(['status' => 'expired', 'responded_at' => now()]);
    }

    // ---- Kuruluş ve kimlik (§2) -------------------------------------------

    public function createTeam(User $founder, array $data): Team
    {
        $name = trim((string) ($data['name'] ?? ''));
        $tag = trim((string) ($data['tag'] ?? ''));
        $this->validateName($name);
        $this->validateTag($tag);
        $nameKey = self::keyify($name);
        $tagKey = self::keyify($tag);

        $this->assertCanJoin($founder); // Premium + ≥20 puanlı maç + başka takımda değil + bekleme yok
        if (Team::where('name_key', $nameKey)->exists()) {
            throw new TeamException('name_taken', 409);
        }
        if (Team::where('tag_key', $tagKey)->exists()) {
            throw new TeamException('tag_taken', 409);
        }

        try {
            return DB::transaction(function () use ($founder, $data, $name, $tag, $nameKey, $tagKey) {
                // Çift-tık/eşzamanlı istek: kullanıcı satırını kilitle → ikinci istek beklesin.
                $locked = User::query()->lockForUpdate()->findOrFail($founder->id);
                if (TeamMember::where('user_id', $locked->id)->exists()) {
                    throw new TeamException('already_in_team', 409);
                }
                if ($this->wallet->spendable($locked) < TeamRules::FOUND_COST) {
                    throw new TeamException('insufficient_coins', 422);
                }
                $team = Team::create([
                    'name' => $name, 'name_key' => $nameKey,
                    'tag' => $tag, 'tag_key' => $tagKey,
                    'logo' => $data['logo'] ?? null,
                    'color1' => $data['color1'] ?? '#A83A2B',
                    'color2' => $data['color2'] ?? '#1f2933',
                    'description' => $data['description'] ?? null,
                    'founder_id' => $locked->id,
                    'status' => 'active',
                    'applications_open' => true,
                    'member_count' => 1,
                    'rating_avg' => (float) ($locked->rating ?? 1500),
                ]);
                TeamMember::create([
                    'team_id' => $team->id, 'user_id' => $locked->id,
                    'role' => 'founder', 'joined_at' => now(),
                ]);
                // Coin kesme AYNI transaction'da: kuruluş rollback olursa coin iade (kayıp yok),
                // başarıda bir kez (çift-tık ikinci isteği "already_in_team" ile düşer → tek kesinti).
                $this->wallet->debit($locked, TeamRules::FOUND_COST, 'team_create', 'team', $team->id);
                $this->audit($team, $locked->id, 'team_created');

                return $team;
            });
        } catch (QueryException $e) {
            // Yarış: unique index (name_key/tag_key/user_id) ikinci isteği reddetti.
            throw new TeamException('name_or_tag_taken', 409);
        }
    }

    /** Yalnız kurucu; ≥30 gün + 10.000 coin; gerçek değişiklik yoksa ücretsiz + dokunma. */
    public function rename(Team $team, User $actor, ?string $name, ?string $tag): Team
    {
        if ((int) $team->founder_id !== (int) $actor->id) {
            throw new TeamException('founder_only', 403);
        }
        $newName = $name !== null ? trim($name) : $team->name;
        $newTag = $tag !== null ? trim($tag) : $team->tag;
        $nameChanged = $newName !== $team->name;
        $tagChanged = $newTag !== $team->tag;
        if (! $nameChanged && ! $tagChanged) {
            return $team; // gerçek değişiklik yok → ücret/bekleme işletilmez
        }
        if ($nameChanged) {
            $this->validateName($newName);
        }
        if ($tagChanged) {
            $this->validateTag($newTag);
        }
        $nameKey = self::keyify($newName);
        $tagKey = self::keyify($newTag);
        if ($nameChanged && Team::where('name_key', $nameKey)->where('id', '!=', $team->id)->exists()) {
            throw new TeamException('name_taken', 409);
        }
        if ($tagChanged && Team::where('tag_key', $tagKey)->where('id', '!=', $team->id)->exists()) {
            throw new TeamException('tag_taken', 409);
        }

        try {
            return DB::transaction(function () use ($team, $actor, $newName, $newTag, $nameKey, $tagKey) {
                $lockedTeam = Team::query()->lockForUpdate()->findOrFail($team->id);
                // Bekleme kontrolü kilit ALTINDA (çift-tık: ilk commit name_changed_at yazar → ikinci düşer).
                if ($lockedTeam->name_changed_at
                    && $lockedTeam->name_changed_at->gt(now()->subDays(TeamRules::RENAME_COOLDOWN_DAYS))) {
                    throw new TeamException('rename_cooldown', 429);
                }
                $locked = User::query()->lockForUpdate()->findOrFail($actor->id);
                if ($this->wallet->spendable($locked) < TeamRules::RENAME_COST) {
                    throw new TeamException('insufficient_coins', 422);
                }
                $this->wallet->debit(
                    $locked, TeamRules::RENAME_COST, 'team_rename', 'team', $team->id,
                    'team_rename:'.$team->id.':'.$nameKey.':'.$tagKey
                );
                $lockedTeam->name = $newName;
                $lockedTeam->name_key = $nameKey;
                $lockedTeam->tag = $newTag;
                $lockedTeam->tag_key = $tagKey;
                $lockedTeam->name_changed_at = now();
                $lockedTeam->save();
                $this->audit($lockedTeam, $actor->id, 'renamed', null, ['name' => $newName, 'tag' => $newTag]);

                return $lockedTeam;
            });
        } catch (QueryException $e) {
            throw new TeamException('name_or_tag_taken', 409);
        }
    }

    /** Logo/renk/açıklama/başvuru ayarları — yalnız kurucu, ücretsiz, bekleme yok (§2/§3). */
    public function updateIdentity(User $actor, Team $team, array $data): Team
    {
        $this->managerOrFail($team, $actor->id, founderOnly: true);
        if (array_key_exists('color1', $data)) {
            $team->color1 = $data['color1'];
        }
        if (array_key_exists('color2', $data)) {
            $team->color2 = $data['color2'];
        }
        if (array_key_exists('description', $data)) {
            $team->description = $data['description'];
        }
        if (array_key_exists('logo_preset', $data)) {
            $team->logo = $data['logo_preset']; // hazır logo → anında geçerli
        }
        if (array_key_exists('logo_pending', $data)) {
            $team->logo_pending = $data['logo_pending']; // yüklenen → admin onayına kadar eski logo
        }
        if (array_key_exists('applications_open', $data)) {
            $team->applications_open = (bool) $data['applications_open'];
        }
        if (array_key_exists('min_apply_rating', $data)) {
            $team->min_apply_rating = $data['min_apply_rating'] !== null ? (int) $data['min_apply_rating'] : null;
        }
        $team->save();
        $this->audit($team, $actor->id, 'identity_updated');

        return $team;
    }

    // ---- Başvuru / Davet / Üyelik (§4) ------------------------------------

    public function apply(User $user, Team $team): TeamApplication
    {
        if ($team->status !== 'active') {
            throw new TeamException('team_closed', 409);
        }
        if (! $team->applications_open) {
            throw new TeamException('applications_closed', 403);
        }
        $this->assertCanJoin($user, $team->min_apply_rating);
        $open = TeamApplication::where('user_id', $user->id)->where('status', 'pending')->count();
        if ($open >= TeamRules::MAX_OPEN_APPLICATIONS) {
            throw new TeamException('too_many_applications', 409);
        }
        if (TeamApplication::where('user_id', $user->id)->where('team_id', $team->id)->where('status', 'pending')->exists()) {
            throw new TeamException('already_applied', 409);
        }
        if ($team->member_count >= TeamRules::CAPACITY) {
            throw new TeamException('team_full', 409);
        }

        return TeamApplication::create([
            'team_id' => $team->id, 'user_id' => $user->id, 'status' => 'pending',
            'rating_at_apply' => (int) ($user->rating ?? 0),
        ]);
    }

    public function cancelApplication(User $user, TeamApplication $app): void
    {
        if ((int) $app->user_id !== (int) $user->id) {
            throw new TeamException('not_your_application', 403);
        }
        if ($app->status !== 'pending') {
            throw new TeamException('application_not_pending', 409);
        }
        $app->update(['status' => 'cancelled', 'decided_at' => now()]);
    }

    public function decideApplication(User $actor, TeamApplication $app, bool $accept): void
    {
        $team = Team::findOrFail($app->team_id);
        $this->managerOrFail($team, $actor->id); // kurucu veya yardımcı

        if (! $accept) {
            if ($app->status !== 'pending') {
                throw new TeamException('application_not_pending', 409);
            }
            $app->update(['status' => 'rejected', 'decided_by' => $actor->id, 'decided_at' => now()]);
            $this->audit($team, $actor->id, 'application_rejected', $app->user_id);
            Notification::notify($app->user_id, 'Takım başvurusu', $team->name.' başvurunu reddetti.', 'team');

            return;
        }

        DB::transaction(function () use ($actor, $app, $team) {
            $lockedTeam = Team::query()->lockForUpdate()->findOrFail($team->id);
            $freshApp = TeamApplication::query()->lockForUpdate()->findOrFail($app->id);
            if ($freshApp->status !== 'pending') {
                throw new TeamException('application_not_pending', 409);
            }
            if ($lockedTeam->status !== 'active') {
                throw new TeamException('team_closed', 409);
            }
            // Son kontenjan yarışı: kilit altında taze sayıdan kontrol → ikinci kabul "team_full".
            if ($lockedTeam->member_count >= TeamRules::CAPACITY) {
                throw new TeamException('team_full', 409);
            }
            $applicant = User::findOrFail($freshApp->user_id);
            $this->assertCanJoin($applicant, $lockedTeam->min_apply_rating); // kabul anında yeniden doğrula
            $this->addMember($lockedTeam, $applicant->id, 'member');
            $freshApp->update(['status' => 'accepted', 'decided_by' => $actor->id, 'decided_at' => now()]);
            $this->invalidateOtherPending($applicant->id, $lockedTeam->id);
            $this->audit($lockedTeam, $actor->id, 'application_accepted', $applicant->id);
            Notification::notify($applicant->id, 'Takıma katıldın', $lockedTeam->name.' başvurunu kabul etti.', 'team');
        });
    }

    public function invite(User $actor, Team $team, int $userId): TeamInvite
    {
        $this->managerOrFail($team, $actor->id); // kurucu veya yardımcı
        if ($team->status !== 'active') {
            throw new TeamException('team_closed', 409);
        }
        if (! User::whereKey($userId)->exists()) {
            throw new TeamException('user_not_found', 404);
        }
        if (TeamMember::where('user_id', $userId)->exists()) {
            throw new TeamException('target_in_team', 409);
        }
        if ($team->member_count >= TeamRules::CAPACITY) {
            throw new TeamException('team_full', 409);
        }
        if (TeamInvite::where('team_id', $team->id)->where('user_id', $userId)->where('status', 'pending')->exists()) {
            throw new TeamException('already_invited', 409);
        }
        $inv = TeamInvite::create([
            'team_id' => $team->id, 'user_id' => $userId, 'invited_by' => $actor->id, 'status' => 'pending',
        ]);
        $this->audit($team, $actor->id, 'invited', $userId);
        Notification::notify($userId, 'Takım daveti', $team->name.' seni takımına davet etti.', 'team', 'team_invite', $team->id);

        return $inv;
    }

    public function acceptInvite(User $user, TeamInvite $inv): void
    {
        if ((int) $inv->user_id !== (int) $user->id) {
            throw new TeamException('not_your_invite', 403);
        }
        DB::transaction(function () use ($user, $inv) {
            $freshInv = TeamInvite::query()->lockForUpdate()->findOrFail($inv->id);
            if ($freshInv->status !== 'pending') {
                throw new TeamException('invite_not_pending', 409);
            }
            $team = Team::query()->lockForUpdate()->findOrFail($freshInv->team_id);
            if ($team->status !== 'active') {
                throw new TeamException('team_closed', 409);
            }
            if ($team->member_count >= TeamRules::CAPACITY) {
                throw new TeamException('team_full', 409);
            }
            $this->assertCanJoin($user, $team->min_apply_rating); // kabul anında yeniden doğrula (§4)
            $this->addMember($team, $user->id, 'member');
            $freshInv->update(['status' => 'accepted', 'responded_at' => now()]);
            $this->invalidateOtherPending($user->id, $team->id);
            $this->audit($team, $user->id, 'invite_accepted', $user->id);
            Notification::notify($team->founder_id, 'Yeni üye', $user->nickname.' takıma katıldı.', 'team');
        });
    }

    public function declineInvite(User $user, TeamInvite $inv): void
    {
        if ((int) $inv->user_id !== (int) $user->id) {
            throw new TeamException('not_your_invite', 403);
        }
        if ($inv->status !== 'pending') {
            throw new TeamException('invite_not_pending', 409);
        }
        $inv->update(['status' => 'declined', 'responded_at' => now()]);
    }

    public function revokeInvite(User $actor, TeamInvite $inv): void
    {
        $team = Team::findOrFail($inv->team_id);
        $this->managerOrFail($team, $actor->id);
        if ($inv->status !== 'pending') {
            throw new TeamException('invite_not_pending', 409);
        }
        $inv->update(['status' => 'revoked', 'responded_at' => now()]);
    }

    public function leave(User $user): void
    {
        $m = TeamMember::where('user_id', $user->id)->first();
        if (! $m) {
            throw new TeamException('not_in_team', 409);
        }
        if ($m->role === 'founder') {
            throw new TeamException('founder_must_transfer_or_close', 409);
        }
        $team = Team::find($m->team_id);
        DB::transaction(function () use ($m, $team, $user) {
            $m->delete();
            if ($team) {
                $this->recompute($team);
                $this->audit($team, $user->id, 'left', $user->id);
            }
            $this->startCooldown($user->id, 'left');
        });
    }

    public function kick(User $actor, Team $team, int $targetUserId): void
    {
        $actorM = $this->managerOrFail($team, $actor->id);
        if ($targetUserId === (int) $actor->id) {
            throw new TeamException('cannot_kick_self', 422);
        }
        $target = TeamMember::where('team_id', $team->id)->where('user_id', $targetUserId)->first();
        if (! $target) {
            throw new TeamException('not_a_member', 404);
        }
        if ($target->role === 'founder') {
            throw new TeamException('cannot_kick_founder', 403);
        }
        // Yardımcı YALNIZ normal üyeyi çıkarabilir (yardımcı/kurucu çıkaramaz — §3).
        if ($actorM->role === 'assistant' && $target->role !== 'member') {
            throw new TeamException('assistant_cannot_kick_manager', 403);
        }
        DB::transaction(function () use ($actor, $team, $target, $targetUserId) {
            $target->delete();
            $this->recompute($team);
            $this->startCooldown($targetUserId, 'kicked');
            $this->audit($team, $actor->id, 'kicked', $targetUserId);
            Notification::notify($targetUserId, 'Takımdan çıkarıldın', $team->name.' takımından çıkarıldın.', 'team');
        });
    }

    public function promoteAssistant(User $founderUser, Team $team, int $targetUserId): void
    {
        $this->managerOrFail($team, $founderUser->id, founderOnly: true);
        DB::transaction(function () use ($founderUser, $team, $targetUserId) {
            $lockedTeam = Team::query()->lockForUpdate()->findOrFail($team->id);
            $target = TeamMember::where('team_id', $lockedTeam->id)->where('user_id', $targetUserId)->first();
            if (! $target) {
                throw new TeamException('not_a_member', 404);
            }
            if ($target->role !== 'member') {
                throw new TeamException('not_a_member', 409);
            }
            // En fazla 2 yardımcı: kilit altında taze say.
            $count = TeamMember::where('team_id', $lockedTeam->id)->where('role', 'assistant')->count();
            if ($count >= TeamRules::MAX_ASSISTANTS) {
                throw new TeamException('too_many_assistants', 409);
            }
            $seq = (int) (TeamMember::where('team_id', $lockedTeam->id)->max('appointed_seq')) + 1;
            $target->update(['role' => 'assistant', 'appointed_seq' => $seq]);
            $this->audit($lockedTeam, $founderUser->id, 'assistant_promoted', $targetUserId);
            Notification::notify($targetUserId, 'Yardımcı oldun', $lockedTeam->name.' seni yardımcı yaptı.', 'team');
        });
    }

    public function demoteAssistant(User $founderUser, Team $team, int $targetUserId): void
    {
        $this->managerOrFail($team, $founderUser->id, founderOnly: true);
        $target = TeamMember::where('team_id', $team->id)->where('user_id', $targetUserId)->first();
        if (! $target || $target->role !== 'assistant') {
            throw new TeamException('not_an_assistant', 409);
        }
        $target->update(['role' => 'member', 'appointed_seq' => null]);
        $this->audit($team, $founderUser->id, 'assistant_demoted', $targetUserId);
    }

    /** Kuruluşu devret (doğrudan — test/iç kullanım; API iki-adımlı propose/accept kullanır). */
    public function transferFounder(User $founderUser, Team $team, int $newFounderId): void
    {
        $this->managerOrFail($team, $founderUser->id, founderOnly: true);
        if ($newFounderId === (int) $founderUser->id) {
            throw new TeamException('already_founder', 409);
        }
        $this->doTransfer($team, $newFounderId, $founderUser->id, 'manual');
    }

    /** Devir teklifi (§5): kurucu önerir → hedefin AÇIK kabulü beklenir (pending_transfer_to). */
    public function proposeTransfer(User $founderUser, Team $team, int $newFounderId): void
    {
        $this->managerOrFail($team, $founderUser->id, founderOnly: true);
        if ($newFounderId === (int) $founderUser->id) {
            throw new TeamException('already_founder', 409);
        }
        $target = TeamMember::where('team_id', $team->id)->where('user_id', $newFounderId)->first();
        if (! $target) {
            throw new TeamException('not_a_member', 404);
        }
        $u = User::find($newFounderId);
        if (! $u || ! $this->isPremium($u)) {
            throw new TeamException('new_founder_not_premium', 403);
        }
        $team->update(['pending_transfer_to' => $newFounderId]);
        Notification::notify($newFounderId, 'Kuruculuk teklifi', $team->name.' kuruculuğu sana devretmek istiyor. Kabul et.', 'team', 'team_transfer', $team->id);
    }

    /** Devir teklifini kabul (§5): yalnız hedef kullanıcı. Şartlar yeniden kontrol edilir. */
    public function acceptTransfer(User $user, Team $team): void
    {
        if ((int) $team->pending_transfer_to !== (int) $user->id) {
            throw new TeamException('no_transfer_offer', 409);
        }
        $this->doTransfer($team, (int) $user->id, (int) $team->founder_id, 'manual_accepted');
        $team->update(['pending_transfer_to' => null]);
    }

    /** Yüklenen logoyu onayla (admin): logo_pending → yürürlükteki logo. */
    public function approveLogo(Team $team, ?int $adminId = null): void
    {
        if (! $team->logo_pending) {
            return;
        }
        $team->update(['logo' => $team->logo_pending, 'logo_pending' => null]);
        $this->audit($team, $adminId, 'logo_approved');
    }

    /** Yüklenen logoyu reddet (admin): eski logo kalır. */
    public function rejectLogo(Team $team, ?int $adminId = null): void
    {
        if (! $team->logo_pending) {
            return;
        }
        $team->update(['logo_pending' => null]);
        $this->audit($team, $adminId, 'logo_rejected');
    }

    /** Atomik devir (manuel kabul sonrası VEYA kurucu 60 gün inaktifse otomatik — §5). */
    public function doTransfer(Team $team, int $newFounderId, ?int $actorId, string $reason): void
    {
        DB::transaction(function () use ($team, $newFounderId, $actorId, $reason) {
            $lockedTeam = Team::query()->lockForUpdate()->findOrFail($team->id);
            $new = TeamMember::where('team_id', $lockedTeam->id)->where('user_id', $newFounderId)->first();
            if (! $new) {
                throw new TeamException('not_a_member', 404);
            }
            $newUser = User::find($newFounderId);
            if (! $newUser || ! $this->isPremium($newUser)) {
                throw new TeamException('new_founder_not_premium', 403);
            }
            $old = TeamMember::where('team_id', $lockedTeam->id)->where('role', 'founder')->first();
            if ($old) {
                $old->role = 'member';
                $oldUser = User::find($old->user_id);
                // Eski kurucunun Premium'u yoksa 7 günlük yenileme süresi başlar (§5).
                if ($oldUser && ! $this->isPremium($oldUser)) {
                    $old->premium_grace_until = now()->addDays(TeamRules::PREMIUM_GRACE_DAYS);
                }
                $old->save();
            }
            $new->role = 'founder';
            $new->premium_grace_until = null;
            $new->save();
            $lockedTeam->founder_id = $newFounderId;
            $lockedTeam->save();
            $this->audit($lockedTeam, $actorId, 'founder_transferred', $newFounderId, ['reason' => $reason]);
            Notification::notify($newFounderId, 'Kuruculuk sende', $lockedTeam->name.' kuruculuğu sana devredildi.', 'team');
            if ($old) {
                Notification::notify($old->user_id, 'Kuruculuk devri', $lockedTeam->name.' kuruculuğu devredildi.', 'team');
            }
        });
    }

    public function closeTeam(User $founderUser, Team $team, bool $confirmed): void
    {
        $this->managerOrFail($team, $founderUser->id, founderOnly: true);
        if (! $confirmed) {
            throw new TeamException('confirmation_required', 422);
        }
        $active = TeamMatch::where(function ($q) use ($team) {
            $q->where('home_team_id', $team->id)->orWhere('away_team_id', $team->id);
        })->whereIn('status', ['proposed', 'scheduled', 'live'])->exists();
        if ($active) {
            throw new TeamException('active_matches_pending', 409);
        }
        DB::transaction(function () use ($founderUser, $team) {
            $memberIds = TeamMember::where('team_id', $team->id)->pluck('user_id')->all();
            TeamMember::where('team_id', $team->id)->delete();
            foreach ($memberIds as $uid) {
                $this->startCooldown((int) $uid, 'team_closed'); // kapanma nedeniyle çıkanlara da 72s (§12)
            }
            TeamApplication::where('team_id', $team->id)->where('status', 'pending')
                ->update(['status' => 'cancelled', 'decided_at' => now()]);
            TeamInvite::where('team_id', $team->id)->where('status', 'pending')
                ->update(['status' => 'revoked', 'responded_at' => now()]);
            $team->status = 'closed';
            $team->closed_at = now();
            $team->closed_by = $founderUser->id;
            $team->member_count = 0;
            $team->save();
            $this->audit($team, $founderUser->id, 'team_closed');
        });
        // Tarihsel maçlar / aylık sonuçlar / ödüller / denetim kayıtları KORUNUR (§12).
    }

    /** Admin takımı kapatır (§12): kurucu/onay şartı yok; yine de sonuçlanmamış karşılaşma varsa engelle. */
    public function adminClose(Team $team, int $adminId): void
    {
        if ($team->status !== 'active') {
            throw new TeamException('already_closed', 409);
        }
        $active = TeamMatch::where(function ($q) use ($team) {
            $q->where('home_team_id', $team->id)->orWhere('away_team_id', $team->id);
        })->whereIn('status', ['proposed', 'scheduled', 'live'])->exists();
        if ($active) {
            throw new TeamException('active_matches_pending', 409);
        }
        DB::transaction(function () use ($adminId, $team) {
            $memberIds = TeamMember::where('team_id', $team->id)->pluck('user_id')->all();
            TeamMember::where('team_id', $team->id)->delete();
            foreach ($memberIds as $uid) {
                $this->startCooldown((int) $uid, 'team_closed');
            }
            TeamApplication::where('team_id', $team->id)->where('status', 'pending')->update(['status' => 'cancelled', 'decided_at' => now()]);
            TeamInvite::where('team_id', $team->id)->where('status', 'pending')->update(['status' => 'revoked', 'responded_at' => now()]);
            $team->update(['status' => 'closed', 'closed_at' => now(), 'closed_by' => $adminId, 'member_count' => 0]);
            $this->audit($team, $adminId, 'team_closed_by_admin');
        });
    }

    // ---- Premium devamlılığı & kurucu inaktifliği (§5) — tick'ten çağrılır ----

    /**
     * Premium'u biten normal üye/yardımcı için 7 günlük yenileme süresi; yenilemezse çıkar (72s
     * bekleme başlar). Kurucu ASLA bu süpürmeden etkilenmez (§5). Clock dışarıdan → test edilebilir.
     */
    public function premiumGraceSweep(?Carbon $now = null): int
    {
        $now = $now ? $now->copy() : now();
        $removed = 0;
        TeamMember::where('role', '!=', 'founder')->orderBy('id')->chunkById(300, function ($members) use ($now, &$removed) {
            foreach ($members as $m) {
                $user = User::find($m->user_id);
                if (! $user) {
                    continue;
                }
                if ($this->isPremium($user)) {
                    if ($m->premium_grace_until !== null) {
                        $m->update(['premium_grace_until' => null]); // zamanında yeniledi
                    }

                    continue;
                }
                if ($m->premium_grace_until === null) {
                    $m->update(['premium_grace_until' => $now->copy()->addDays(TeamRules::PREMIUM_GRACE_DAYS)]);
                    Notification::notify($m->user_id, 'Premium yenileme süresi', 'Premium bitti; 7 gün içinde yenile yoksa takımdan çıkarılırsın.', 'team');

                    continue;
                }
                if ($m->premium_grace_until->lte($now)) {
                    $team = Team::find($m->team_id);
                    DB::transaction(function () use ($m, $team) {
                        $m->delete();
                        if ($team) {
                            $this->recompute($team);
                        }
                    });
                    $this->startCooldown((int) $m->user_id, 'premium_lapsed', $now);
                    if ($team) {
                        $this->audit($team, null, 'premium_auto_removed', (int) $m->user_id);
                    }
                    Notification::notify($m->user_id, 'Takımdan çıkarıldın', 'Premium yenilenmediği için takımdan çıkarıldın.', 'team');
                    $removed++;
                }
            }
        });

        return $removed;
    }

    /** Kurucu son girişinden 60 gün geçtiyse en önce atanmış aktif-Premium yardımcıya otomatik devir. */
    public function founderInactivitySweep(?Carbon $now = null): int
    {
        $now = $now ? $now->copy() : now();
        $cutoff = $now->copy()->subDays(TeamRules::FOUNDER_INACTIVE_DAYS);
        $transfers = 0;
        Team::where('status', 'active')->orderBy('id')->chunkById(300, function ($teams) use ($cutoff, &$transfers) {
            foreach ($teams as $team) {
                $founder = User::find($team->founder_id);
                if (! $founder) {
                    continue;
                }
                $last = $founder->last_login_at ?? ($founder->last_seen ?? null);
                if (! $last || Carbon::parse($last)->gt($cutoff)) {
                    continue; // hiç giriş yok (güvenli → dokunma) veya hâlâ aktif
                }
                $cand = TeamMember::where('team_id', $team->id)->where('role', 'assistant')
                    ->orderBy('appointed_seq')->get()
                    ->first(fn ($a) => ($u = User::find($a->user_id)) && $this->isPremium($u));
                if (! $cand) {
                    continue; // uygun yardımcı yok → devir yapma (§5)
                }
                $this->doTransfer($team, (int) $cand->user_id, null, 'founder_inactive');
                $transfers++;
            }
        });

        return $transfers;
    }
}
