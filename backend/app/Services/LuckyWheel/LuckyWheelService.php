<?php

namespace App\Services\LuckyWheel;

use App\Models\LuckyWheelReward;
use App\Models\LuckyWheelSpin;
use App\Models\LuckyWheelUserState;
use App\Models\User;
use App\Support\LuckyWheelSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Şans Çarkı çekirdek mantığı: uygun ödül havuzu, güvenli ağırlıklı seçim (random_int),
 * çevirme hakkı yönetimi ve atomik (transaction + satır kilidi) spin.
 *
 * KRİTİK: Kazananı DAİMA backend seçer (random_int = CSPRNG). Frontend yalnız animasyon.
 * Dilim sayısı sabit değildir; eligible() havuzunun büyüklüğüdür (min/max ile sınırlı).
 */
class LuckyWheelService
{
    public function __construct(private RewardFulfillmentService $fulfillment)
    {
    }

    public function isEnabled(): bool
    {
        return LuckyWheelSettings::bool('enabled');
    }

    /** Çarkta görünecek ödüller (aktif + tarih + stok), sıraya göre. */
    public function eligibleRewards(): Collection
    {
        return LuckyWheelReward::query()->eligible()->get();
    }

    /** Çark kurulu ve çevrilebilir mi (yeterli dilim var mı)? */
    public function isReady(?Collection $pool = null): bool
    {
        $pool ??= $this->eligibleRewards();
        $min = max(2, LuckyWheelSettings::int('min_slice_count'));
        return $this->isEnabled() && $pool->count() >= $min;
    }

    /** id => gerçek yüzde (weight / toplam aktif weight * 100). Yalnız bilgi amaçlı. */
    public function percentages(Collection $pool): array
    {
        $total = (int) $pool->sum(fn ($r) => max(0, (int) $r->weight));
        $out = [];
        foreach ($pool as $r) {
            $out[$r->id] = $total > 0 ? round(max(0, (int) $r->weight) / $total * 100, 2) : 0.0;
        }
        return $out;
    }

    /** Frontend'e gönderilecek güvenli ödül listesi (miktar dahil; weight yalnız izinliyse). */
    public function publicRewards(Collection $pool): array
    {
        $showProb = LuckyWheelSettings::bool('show_probability');
        $pct = $showProb ? $this->percentages($pool) : [];
        $palette = config('lucky-wheel.palette', []);
        $out = [];
        $i = 0;
        foreach ($pool as $r) {
            $out[] = [
                'id' => $r->id,
                'name' => $r->name,
                'description' => $r->description,
                'type' => $r->type,
                'amount' => (int) $r->amount,
                'icon' => $r->icon ?: config('lucky-wheel.type_icons.'.$r->type, 'gift'),
                'sliceColor' => $r->slice_color ?: ($palette[$i % max(1, count($palette))] ?? '#a83a2b'),
                'textColor' => $r->text_color ?: '#ffffff',
                'probability' => $showProb ? ($pct[$r->id] ?? 0) : null,
            ];
            $i++;
        }
        return $out;
    }

    // ---- Çevirme hakkı yönetimi ----

    /** Günlük hakların ait olduğu döngü başlangıcı (reset_hour + timezone). */
    public function cycleStart(): Carbon
    {
        $resetHour = max(0, min(23, LuckyWheelSettings::int('reset_hour')));
        $now = now();
        $start = $now->copy()->startOfDay()->addHours($resetHour);
        if ($now->lt($start)) {
            $start = $start->subDay();
        }
        return $start;
    }

    /** Yeni gün girildiyse günlük sayaç sıfırlanır (state kaydeder). */
    public function resetIfNeeded(LuckyWheelUserState $state): void
    {
        $today = $this->cycleStart()->toDateString();
        if ($state->reset_date?->toDateString() !== $today) {
            $state->daily_free_spins_used = 0;
            $state->reset_date = $today;
            $state->save();
        }
    }

    public function freeRemaining(LuckyWheelUserState $state): int
    {
        $perDay = max(0, LuckyWheelSettings::int('free_spins_per_day'));
        return max(0, $perDay - (int) $state->daily_free_spins_used);
    }

    public function remaining(LuckyWheelUserState $state): int
    {
        return $this->freeRemaining($state) + max(0, (int) $state->bonus_spins);
    }

    /** Ücretsiz hakların yenileneceği an (hepsi bittiyse), yoksa null. */
    public function nextFreeSpinAt(LuckyWheelUserState $state): ?string
    {
        if ($this->freeRemaining($state) > 0) {
            return null;
        }
        return $this->cycleStart()->copy()->addDay()->toIso8601String();
    }

    /** Ardışık çevirme bekleme saniyesi (cooldown), yoksa 0. */
    public function cooldownRemaining(LuckyWheelUserState $state): int
    {
        $mins = max(0, LuckyWheelSettings::int('cooldown_minutes'));
        if ($mins <= 0 || ! $state->last_spin_at) {
            return 0;
        }
        $ready = Carbon::parse($state->last_spin_at)->addMinutes($mins);
        return $ready->isFuture() ? (int) ceil(now()->diffInSeconds($ready, false)) : 0;
    }

    /** GET /lucky-wheel yükü. */
    public function stateFor(?User $user): array
    {
        $pool = $this->eligibleRewards();
        $ready = $this->isReady($pool);

        $remaining = 0;
        $next = null;
        $bonus = 0;
        $coins = 0;
        $cooldown = 0;
        if ($user) {
            $state = LuckyWheelUserState::forUser($user->id);
            $this->resetIfNeeded($state);
            $remaining = $this->remaining($state);
            $next = $this->nextFreeSpinAt($state);
            $bonus = (int) $state->bonus_spins;
            $coins = (int) ($user->coins ?? 0);
            $cooldown = $this->cooldownRemaining($state);
        }

        $spinCost = max(0, LuckyWheelSettings::int('spin_cost'));

        return [
            'enabled' => $this->isEnabled(),
            'ready' => $ready,
            'settings' => [
                'animationDuration' => LuckyWheelSettings::int('animation_duration'),
                'showProbability' => LuckyWheelSettings::bool('show_probability'),
                'freeSpinsPerDay' => LuckyWheelSettings::int('free_spins_per_day'),
                'requireLogin' => LuckyWheelSettings::bool('require_login'),
                'spinCost' => $spinCost,
            ],
            'rewards' => $this->publicRewards($pool),
            'sliceCount' => $pool->count(),
            'remainingSpins' => $remaining,
            'bonusSpins' => $bonus,
            'nextFreeSpinAt' => $next,
            'cooldownSeconds' => $cooldown,
            'coins' => $coins,
            'spinCost' => $spinCost,
            // Sıradaki çevirme ücretsiz/bonus yoksa coin ile ödemeli olacak.
            'nextSpinPaid' => $user ? ($remaining <= 0 && $spinCost > 0) : false,
        ];
    }

    // ---- Kazanma sayaç yardımcıları ----

    private function winsToday(int $rewardId): int
    {
        return LuckyWheelSpin::where('reward_id', $rewardId)
            ->where('created_at', '>=', $this->cycleStart())
            ->count();
    }

    private function userWinsToday(int $rewardId, int $userId): int
    {
        return LuckyWheelSpin::where('reward_id', $rewardId)
            ->where('user_id', $userId)
            ->where('created_at', '>=', $this->cycleStart())
            ->count();
    }

    private function userWinsLifetime(int $rewardId, int $userId): int
    {
        return LuckyWheelSpin::where('reward_id', $rewardId)
            ->where('user_id', $userId)
            ->count();
    }

    /** Bu an bu kullanıcı bu ödülü KAZANABİLİR mi (limit/stok)? Ödül satırı kilitliyken çağrılır. */
    private function winnable(LuckyWheelReward $r, int $userId): bool
    {
        if (! $r->is_active || (int) $r->weight <= 0) {
            return false;
        }
        $now = now();
        if ($r->starts_at && $r->starts_at->isAfter($now)) {
            return false;
        }
        if ($r->ends_at && $r->ends_at->isBefore($now)) {
            return false;
        }
        if ($r->stock !== null && $r->stock <= 0) {
            return false;
        }
        if ($r->daily_win_limit !== null && $this->winsToday($r->id) >= $r->daily_win_limit) {
            return false;
        }
        if ($r->per_user_daily_limit !== null && $this->userWinsToday($r->id, $userId) >= $r->per_user_daily_limit) {
            return false;
        }
        if ($r->per_user_lifetime_limit !== null && $this->userWinsLifetime($r->id, $userId) >= $r->per_user_lifetime_limit) {
            return false;
        }
        return true;
    }

    /** GÜVENLİ ağırlıklı seçim: random_int (CSPRNG). */
    private function weightedPick(Collection $candidates): LuckyWheelReward
    {
        $total = (int) $candidates->sum(fn ($r) => max(1, (int) $r->weight));
        $roll = random_int(1, max(1, $total));
        $acc = 0;
        foreach ($candidates as $r) {
            $acc += max(1, (int) $r->weight);
            if ($roll <= $acc) {
                return $r;
            }
        }
        return $candidates->last();
    }

    /**
     * Kazananı seç: her aday kilitlenip limit/stok doğrulanır (yarış-koşulu güvenli).
     * Doğrulamayı geçemeyen aday havuzdan çıkarılıp yeniden çekilir.
     */
    private function selectWinner(Collection $pool, int $userId): ?LuckyWheelReward
    {
        $candidates = $pool->filter(fn ($r) => (int) $r->weight > 0)->values();
        while ($candidates->isNotEmpty()) {
            $pick = $this->weightedPick($candidates);
            $locked = LuckyWheelReward::where('id', $pick->id)->lockForUpdate()->first();
            if ($locked && $this->winnable($locked, $userId)) {
                return $locked;
            }
            $candidates = $candidates->reject(fn ($r) => $r->id === $pick->id)->values();
        }
        return null;
    }

    /**
     * ATOMİK SPIN. Tüm doğrulama+dağıtım tek transaction'da; hata olursa hiçbir şey değişmez
     * (spin hakkı da harcanmaz). Dönen dizi 'error' içeriyorsa controller mesaja çevirir.
     */
    public function spin(User $user): array
    {
        if (! $this->isEnabled()) {
            return ['error' => 'disabled'];
        }
        $pool = $this->eligibleRewards();
        if (! $this->isReady($pool)) {
            return ['error' => 'not_ready'];
        }

        return DB::transaction(function () use ($user, $pool) {
            $u = User::lockForUpdate()->find($user->id);
            if (! $u) {
                return ['error' => 'disabled'];
            }
            $state = LuckyWheelUserState::forUser($u->id);
            $this->resetIfNeeded($state);

            $cooldown = $this->cooldownRemaining($state);
            if ($cooldown > 0) {
                return ['error' => 'cooldown', 'seconds' => $cooldown];
            }
            // Çevirme finansmanı: önce ücretsiz/bonus hak; bittiyse coin ile ödemeli çevir.
            $cost = max(0, LuckyWheelSettings::int('spin_cost'));
            $freeOrBonus = $this->remaining($state) > 0;
            $paid = false;
            if (! $freeOrBonus) {
                if ($cost <= 0) {
                    // Ödemeli çevirme kapalı ve ücretsiz hak yok.
                    return ['error' => 'no_spins', 'nextFreeSpinAt' => $this->nextFreeSpinAt($state)];
                }
                if ((int) ($u->coins ?? 0) < $cost) {
                    return ['error' => 'need_coins', 'cost' => $cost, 'nextFreeSpinAt' => $this->nextFreeSpinAt($state)];
                }
                $paid = true;
            }

            // Kazananı seç (limit/stok kilidiyle). Hiçbiri kazanılamıyorsa hak/coin harcanmaz.
            $winner = $this->selectWinner($pool, $u->id);
            if (! $winner) {
                return ['error' => 'no_reward'];
            }

            // Hak tüket: önce ücretsiz, sonra bonus, ikisi de bittiyse coin ile ödemeli.
            if ($paid) {
                $u->coins = max(0, (int) ($u->coins ?? 0) - $cost);
                $u->save();
                $spinType = 'paid';
            } elseif ($this->freeRemaining($state) <= 0) {
                $state->bonus_spins = max(0, (int) $state->bonus_spins - 1);
                $spinType = 'bonus';
            } else {
                $state->daily_free_spins_used = (int) $state->daily_free_spins_used + 1;
                $spinType = 'free';
            }

            // Stok + toplam sayaç (winner kilitli).
            if ($winner->stock !== null) {
                $winner->stock = max(0, (int) $winner->stock - 1);
            }
            $winner->total_won = (int) $winner->total_won + 1;
            $winner->save();

            // Ödülü dağıt. FREE_SPIN -> bonus hakkı aynı state satırına ekle.
            if ($winner->type === LuckyWheelReward::TYPE_FREE_SPIN) {
                $state->bonus_spins = (int) $state->bonus_spins + max(1, (int) $winner->amount);
                $this->fulfillment->grant($u, $winner); // yalnız bildirim
            } else {
                $this->fulfillment->grant($u, $winner);
            }

            $state->last_spin_at = now();
            $state->save();

            // Geçmiş: kazanıldığı anki snapshot (admin sonradan değiştirse bozulmaz).
            LuckyWheelSpin::create([
                'user_id' => $u->id,
                'reward_id' => $winner->id,
                'reward_snapshot' => $winner->snapshot(),
                'spin_type' => $spinType,
            ]);

            $u->refresh();

            $remainingAfter = $this->remaining($state);

            return [
                'reward' => $winner->snapshot() + ['description' => $winner->description],
                'winningRewardId' => $winner->id,
                'remainingSpins' => $remainingAfter,
                'bonusSpins' => (int) $state->bonus_spins,
                'nextFreeSpinAt' => $this->nextFreeSpinAt($state),
                'coins' => (int) ($u->coins ?? 0),
                'spinCost' => $cost,
                'nextSpinPaid' => $remainingAfter <= 0 && $cost > 0,
                'paid' => $paid,
                'user' => $u,
            ];
        });
    }
}
