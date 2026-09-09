<?php

namespace App\Services\DiceSlot;

use App\Models\DiceSlotJackpot;
use App\Models\DiceSlotSpin;
use App\Models\DiceSlotUserState;
use App\Models\Notification;
use App\Models\User;
use App\Support\DiceSlotSettings as DS;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Zar Slotu çekirdek mantığı: güvenli ağırlıklı makara seçimi (random_int), üçlü ödül
 * tablosu, ARTAN jackpot havuzu ve atomik (transaction + satır kilidi) spin.
 *
 * KRİTİK: 3 sembolü DAİMA backend seçer (random_int = CSPRNG). Frontend yalnız animasyon.
 * Semboller: d1..d6 (zar yüzleri) + c64 (64 küpü). Aynı üç sembol -> kazanç:
 *   - üçlü zar (d{v}) -> payout_{v} coin
 *   - üçlü 64 (c64)   -> güncel jackpot havuzu (kazanılınca tabana sıfırlanır)
 * Her spinde havuz jackpot_increment kadar büyür (ücretsiz/ödemeli fark etmez).
 *
 * Ekonomi (ücretsiz hak/coin/cooldown/günlük sıfırlama) LuckyWheelService ile aynı desendir.
 */
class DiceSlotService
{
    public const SYMBOLS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'c64'];

    public function isEnabled(): bool
    {
        return DS::bool('enabled');
    }

    // ---- Ekonomi yardımcıları (Şans Çarkı ile aynı) ----

    public function cycleStart(): Carbon
    {
        $resetHour = max(0, min(23, DS::int('reset_hour')));
        $now = now();
        $start = $now->copy()->startOfDay()->addHours($resetHour);
        if ($now->lt($start)) {
            $start = $start->subDay();
        }

        return $start;
    }

    public function resetIfNeeded(DiceSlotUserState $state): void
    {
        $today = $this->cycleStart()->toDateString();
        if ($state->reset_date?->toDateString() !== $today) {
            $state->daily_free_spins_used = 0;
            $state->reset_date = $today;
            $state->save();
        }
    }

    public function freeRemaining(DiceSlotUserState $state): int
    {
        $perDay = max(0, DS::int('free_spins_per_day'));

        return max(0, $perDay - (int) $state->daily_free_spins_used);
    }

    public function remaining(DiceSlotUserState $state): int
    {
        return $this->freeRemaining($state) + max(0, (int) $state->bonus_spins);
    }

    public function nextFreeSpinAt(DiceSlotUserState $state): ?string
    {
        if ($this->freeRemaining($state) > 0) {
            return null;
        }

        return $this->cycleStart()->copy()->addDay()->toIso8601String();
    }

    public function cooldownRemaining(DiceSlotUserState $state): int
    {
        $mins = max(0, DS::int('cooldown_minutes'));
        if ($mins <= 0 || ! $state->last_spin_at) {
            return 0;
        }
        $ready = Carbon::parse($state->last_spin_at)->addMinutes($mins);

        return $ready->isFuture() ? (int) ceil(now()->diffInSeconds($ready, false)) : 0;
    }

    // ---- Ödül tablosu + jackpot ----

    /** Üçlü zar ödülleri: value (1..6) => coin. */
    public function payouts(): array
    {
        $out = [];
        for ($v = 1; $v <= 6; $v++) {
            $out[$v] = max(0, DS::int('payout_'.$v));
        }

        return $out;
    }

    /** Sıralama (kent) ödülü: ardışık üç farklı zar. */
    public function straightPayout(): int
    {
        return max(0, DS::int('payout_straight'));
    }

    /** Frontend gösterimi için ödül tablosu (üçlüler + sıralama + jackpot). */
    public function paytable(): array
    {
        $rows = [];
        foreach ($this->payouts() as $v => $coin) {
            $rows[] = ['code' => 'd'.$v, 'value' => $v, 'payout' => $coin, 'jackpot' => false, 'straight' => false];
        }
        $rows[] = ['code' => 'straight', 'value' => 0, 'payout' => $this->straightPayout(), 'jackpot' => false, 'straight' => true];
        $rows[] = ['code' => 'c64', 'value' => 64, 'payout' => 0, 'jackpot' => true, 'straight' => false];

        return $rows;
    }

    /** Gösterim için güncel jackpot havuzu (kilitsiz). */
    public function jackpotPool(): int
    {
        return (int) DiceSlotJackpot::current()->pool;
    }

    /** GET /dice-slot yükü. */
    public function stateFor(?User $user): array
    {
        $remaining = 0;
        $next = null;
        $bonus = 0;
        $coins = 0;
        $cooldown = 0;
        if ($user) {
            $state = DiceSlotUserState::forUser($user->id);
            $this->resetIfNeeded($state);
            $remaining = $this->remaining($state);
            $next = $this->nextFreeSpinAt($state);
            $bonus = (int) $state->bonus_spins;
            $coins = (int) ($user->coins ?? 0);
            $cooldown = $this->cooldownRemaining($state);
        }

        $spinCost = max(0, DS::int('spin_cost'));

        return [
            'enabled' => $this->isEnabled(),
            'settings' => [
                'freeSpinsPerDay' => DS::int('free_spins_per_day'),
                'requireLogin' => DS::bool('require_login'),
                'spinCost' => $spinCost,
            ],
            'symbols' => self::SYMBOLS,
            'paytable' => $this->paytable(),
            'jackpot' => $this->jackpotPool(),
            'jackpotBase' => max(0, DS::int('jackpot_base')),
            'remainingSpins' => $remaining,
            'bonusSpins' => $bonus,
            'nextFreeSpinAt' => $next,
            'cooldownSeconds' => $cooldown,
            'coins' => $coins,
            'spinCost' => $spinCost,
            'nextSpinPaid' => $user ? ($remaining <= 0 && $spinCost > 0) : false,
        ];
    }

    // ---- Güvenli makara seçimi (CSPRNG) ----

    /** Sembol => ağırlık. Her zar yüzü eşit; 64 küpü ayrı (nadir). */
    private function symbolWeights(): array
    {
        $dw = max(1, DS::int('die_weight'));
        $cw = max(1, DS::int('cube_weight'));

        return ['d1' => $dw, 'd2' => $dw, 'd3' => $dw, 'd4' => $dw, 'd5' => $dw, 'd6' => $dw, 'c64' => $cw];
    }

    /** Tek makara: ağırlıklı random_int seçimi. */
    private function pickSymbol(array $weights, int $total): string
    {
        $roll = random_int(1, max(1, $total));
        $acc = 0;
        foreach ($weights as $sym => $w) {
            $acc += $w;
            if ($roll <= $acc) {
                return $sym;
            }
        }

        return array_key_last($weights);
    }

    /**
     * Sıralama (kent): ardışık üç FARKLI zar, herhangi sırada (poker straight gibi).
     * {1,2,3},{2,3,4},{3,4,5},{4,5,6}. 64 küpü dahil DEĞİL -> kent oluşturamaz.
     */
    private function isStraight(array $reels): bool
    {
        foreach ($reels as $r) {
            if ($r === 'c64') {
                return false;
            }
        }
        $vals = array_map(fn ($r) => (int) substr($r, 1), $reels);
        sort($vals);

        return $vals[0] + 1 === $vals[1] && $vals[1] + 1 === $vals[2];
    }

    /** Üç makarayı BAĞIMSIZ çevir (gerçek slot: her makara ayrı). */
    private function roll(): array
    {
        $weights = $this->symbolWeights();
        $total = array_sum($weights);

        return [
            $this->pickSymbol($weights, $total),
            $this->pickSymbol($weights, $total),
            $this->pickSymbol($weights, $total),
        ];
    }

    /**
     * ATOMİK SPIN. Doğrulama + hak tüketimi + makara + jackpot + ödül tek transaction'da.
     * Hata olursa hiçbir şey değişmez (hak/coin harcanmaz). Dönen dizide 'error' olabilir.
     */
    public function spin(User $user): array
    {
        if (! $this->isEnabled()) {
            return ['error' => 'disabled'];
        }

        return DB::transaction(function () use ($user) {
            $u = User::lockForUpdate()->find($user->id);
            if (! $u) {
                return ['error' => 'disabled'];
            }
            $state = DiceSlotUserState::forUser($u->id);
            $this->resetIfNeeded($state);

            $cooldown = $this->cooldownRemaining($state);
            if ($cooldown > 0) {
                return ['error' => 'cooldown', 'seconds' => $cooldown];
            }

            // Çevirme finansmanı: önce ücretsiz/bonus hak; bittiyse coin ile ödemeli.
            $cost = max(0, DS::int('spin_cost'));
            $freeOrBonus = $this->remaining($state) > 0;
            $paid = false;
            if (! $freeOrBonus) {
                if ($cost <= 0) {
                    return ['error' => 'no_spins', 'nextFreeSpinAt' => $this->nextFreeSpinAt($state)];
                }
                if ((int) ($u->coins ?? 0) < $cost) {
                    return ['error' => 'need_coins', 'cost' => $cost, 'nextFreeSpinAt' => $this->nextFreeSpinAt($state)];
                }
                $paid = true;
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

            // MAKARALARI ÇEVİR (sonuç sunucuda belirlenir).
            $reels = $this->roll();
            [$a, $b, $c] = $reels;

            $winType = 'none';
            $payout = 0;
            $matchedValue = null;
            $jackpotWin = false;

            // Jackpot havuzunu kilitle: her spinde büyür; üçlü 64 ise kazanılıp tabana sıfırlanır.
            $jp = DiceSlotJackpot::where('id', 1)->lockForUpdate()->first();
            if (! $jp) {
                $jp = new DiceSlotJackpot;
                $jp->id = 1;
                $jp->pool = max(0, DS::int('jackpot_base'));
                $jp->total_contributed = 0;
            }
            $inc = max(0, DS::int('jackpot_increment'));
            $jp->pool = (int) $jp->pool + $inc;
            $jp->total_contributed = (int) $jp->total_contributed + $inc;

            if ($a === $b && $b === $c) {
                if ($a === 'c64') {
                    $jackpotWin = true;
                    $winType = 'jackpot';
                    $payout = (int) $jp->pool; // güncel havuzun tamamı
                    $jp->last_won_user_id = $u->id;
                    $jp->last_won_amount = $payout;
                    $jp->last_won_at = now();
                    $jp->pool = max(0, DS::int('jackpot_base')); // tabana sıfırla
                } else {
                    $winType = 'triple';
                    $matchedValue = (int) substr($a, 1);
                    $payout = max(0, $this->payouts()[$matchedValue] ?? 0);
                }
            } elseif ($this->isStraight($reels)) {
                // Sıralama / kent (ardışık üç farklı zar) — üçlü değilse kontrol edilir.
                $winType = 'straight';
                $payout = $this->straightPayout();
            }
            $jp->save();

            // Ödülü ver (coin). Bakiye zaten kilitli $u satırında.
            if ($payout > 0) {
                $u->coins = (int) ($u->coins ?? 0) + $payout;
                $u->save();
            }

            $state->last_spin_at = now();
            $state->save();

            // Kayıt (istatistik + izlenebilirlik).
            DiceSlotSpin::create([
                'user_id' => $u->id,
                'reels' => $reels,
                'win_type' => $winType,
                'payout' => $payout,
                'cost' => $paid ? $cost : 0,
                'spin_type' => $spinType,
                'jackpot_won' => $jackpotWin,
            ]);

            // Bildirim (kazançta). Hata olsa ana işlemi bozmasın.
            if ($payout > 0) {
                try {
                    $title = $jackpotWin ? 'Zar Slotu: JACKPOT! 🎉' : 'Zar Slotu';
                    Notification::notify($u->id, $title, "+{$payout} coin", $jackpotWin ? 'trophy' : 'dice');
                } catch (\Throwable $e) {
                    // yoksay
                }
            }

            $u->refresh();
            $remainingAfter = $this->remaining($state);

            return [
                'reels' => $reels,
                'winType' => $winType,
                'payout' => $payout,
                'matchedValue' => $matchedValue,
                'jackpot' => (int) $jp->pool,      // güncel havuz (kazanıldıysa taban)
                'jackpotWon' => $jackpotWin,
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
