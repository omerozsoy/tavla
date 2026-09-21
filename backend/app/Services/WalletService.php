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
        if ($amount < 0) {
            throw new \RuntimeException('Insufficient wallet balance.');
        }
        return $this->move($user, -$amount, $type, $referenceType, $referenceId);
    }

    public function setBalance(User $user, int $target, string $type = 'admin_adjustment'): User
    {
        return DB::transaction(function () use ($user, $target, $type): User {
            // Hedef bakiye ve rezerve tutar aynı kilitli satırdan okunmalı; aksi halde eşzamanlı
            // bir money-match rezervi, kontrol edilen hedefi işlem sonunda geçersiz bırakabilir.
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($target < (int) ($locked->coins_reserved ?? 0)) {
                throw new \RuntimeException('Wallet balance cannot be below reserved coins.');
            }

            return $this->move($locked, $target - (int) ($locked->coins ?? 0), $type);
        });
    }

    private function move(User $user, int $amount, string $type, ?string $referenceType = null, ?int $referenceId = null): User
    {
        return DB::transaction(function () use ($user, $amount, $type, $referenceType, $referenceId): User {
            // Her ekonomik hareket güncel satırı kilitleyip ledger ile aynı transaction'da işler.
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            $before = (int) ($locked->coins ?? 0);
            $after = $before + $amount;
            if ($after < 0) {
                throw new \RuntimeException('Wallet balance cannot be negative.');
            }
            $ledgerAvailable = Schema::hasTable('wallet_transactions');
            if (! $ledgerAvailable && config('wallet.require_ledger', true)) {
                throw new \RuntimeException('Wallet ledger is unavailable; economic write rejected.');
            }

            $locked->coins = $after;
            $locked->save();

            if ($ledgerAvailable) {
                WalletTransaction::create([
                    'transaction_id' => (string) \Illuminate\Support\Str::uuid(),
                    'user_id' => $locked->id,
                    'amount' => $amount,
                    'balance_before' => $before,
                    'balance_after' => $after,
                    'type' => $type,
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                ]);
            }

            // Çağıran transaction çoğu zaman aynı User nesnesini debit/credit sonrasında
            // başka alanlarla birlikte kaydeder. Kilitli satırın yeni bakiyesini o nesneye de
            // taşı; aksi halde stale model save() ile atomik hareketi geri yazabilir.
            $user->setRawAttributes($locked->getAttributes());
            $user->syncOriginal();

            return $locked;
        });
    }
}
