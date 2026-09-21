<?php

namespace App\Services;

use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WalletService
{
    public function credit(User $user, int $amount, string $type, ?string $referenceType = null, ?int $referenceId = null): User
    {
        if ($amount < 0) {
            throw new \InvalidArgumentException('Wallet credit must be non-negative.');
        }
        return $this->move($user, $amount, $type, $referenceType, $referenceId);
    }

    public function debit(User $user, int $amount, string $type, ?string $referenceType = null, ?int $referenceId = null): User
    {
        if ($amount < 0 || (int) $user->coins < $amount) {
            throw new \RuntimeException('Insufficient wallet balance.');
        }
        return $this->move($user, -$amount, $type, $referenceType, $referenceId);
    }

    public function setBalance(User $user, int $target, string $type = 'admin_adjustment'): User
    {
        if ($target < (int) ($user->coins_reserved ?? 0)) {
            throw new \RuntimeException('Wallet balance cannot be below reserved coins.');
        }
        return $this->move($user, $target - (int) ($user->coins ?? 0), $type);
    }

    private function move(User $user, int $amount, string $type, ?string $referenceType, ?int $referenceId): User
    {
        $before = (int) ($user->coins ?? 0);
        $after = $before + $amount;
        if ($after < 0) {
            throw new \RuntimeException('Wallet balance cannot be negative.');
        }
        $user->coins = $after;
        $user->save();

        if (Schema::hasTable('wallet_transactions')) {
            WalletTransaction::create([
                'transaction_id' => (string) \Illuminate\Support\Str::uuid(),
                'user_id' => $user->id,
                'amount' => $amount,
                'balance_before' => $before,
                'balance_after' => $after,
                'type' => $type,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
            ]);
        }

        return $user;
    }
}
