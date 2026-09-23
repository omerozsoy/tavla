<?php

namespace App\Services;

use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WalletService
{
    public function credit(User $user, int $amount, string $type, ?string $referenceType = null, ?int $referenceId = null, ?string $idempotencyKey = null, ?int $actorUserId = null): User
    {
        if ($amount < 0) {
            throw new \InvalidArgumentException('Wallet credit must be non-negative.');
        }
        return $this->move($user, $amount, $type, $referenceType, $referenceId, $idempotencyKey, $actorUserId);
    }

    public function debit(User $user, int $amount, string $type, ?string $referenceType = null, ?int $referenceId = null, ?string $idempotencyKey = null, ?int $actorUserId = null): User
    {
        if ($amount < 0) {
            throw new \RuntimeException('Insufficient wallet balance.');
        }
        return $this->move($user, -$amount, $type, $referenceType, $referenceId, $idempotencyKey, $actorUserId);
    }

    /**
     * Bakiyeyi mutlak hedefe çeker. $actorUserId doldurulursa (admin panel/CLI) ledger satırına
     * "bu hareketi kim yaptı" olarak yazılır → sonradan "hangi admin coin ekledi" izlenebilir.
     */
    public function setBalance(User $user, int $target, string $type = 'admin_adjustment', ?int $actorUserId = null): User
    {
        return DB::transaction(function () use ($user, $target, $type, $actorUserId): User {
            // Hedef bakiye ve rezerve tutar aynı kilitli satırdan okunmalı; aksi halde eşzamanlı
            // bir money-match rezervi, kontrol edilen hedefi işlem sonunda geçersiz bırakabilir.
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($target < (int) ($locked->coins_reserved ?? 0)) {
                throw new \RuntimeException('Wallet balance cannot be below reserved coins.');
            }

            return $this->move($locked, $target - (int) ($locked->coins ?? 0), $type, null, null, null, $actorUserId);
        });
    }

    private function move(User $user, int $amount, string $type, ?string $referenceType = null, ?int $referenceId = null, ?string $idempotencyKey = null, ?int $actorUserId = null): User
    {
        return DB::transaction(function () use ($user, $amount, $type, $referenceType, $referenceId, $idempotencyKey, $actorUserId): User {
            // Her ekonomik hareket güncel satırı kilitleyip ledger ile aynı transaction'da işler.
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            // Referanslı ekonomik işlemler için çağıranın ayrıca anahtar üretmesine gerek yok:
            // aynı business reference + hareket tipi + kullanıcı deterministik bir replay anahtarıdır.
            $effectiveKey = $idempotencyKey;
            if ($effectiveKey === null && $referenceType !== null && $referenceId !== null) {
                $effectiveKey = 'ref:'.sha1($type.'|'.$referenceType.'|'.$referenceId.'|'.$locked->id);
            }
            if ($effectiveKey !== null && Schema::hasColumn('wallet_transactions', 'idempotency_key')) {
                $replayed = WalletTransaction::query()
                    ->where('idempotency_key', $effectiveKey)
                    ->where('user_id', $locked->id)
                    ->exists();
                if ($replayed) {
                    return $locked;
                }
            }
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
                    'idempotency_key' => $effectiveKey,
                    'user_id' => $locked->id,
                    'amount' => $amount,
                    'balance_before' => $before,
                    'balance_after' => $after,
                    'type' => $type,
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                    'actor_user_id' => ($actorUserId !== null && Schema::hasColumn('wallet_transactions', 'actor_user_id'))
                        ? $actorUserId
                        : null,
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
