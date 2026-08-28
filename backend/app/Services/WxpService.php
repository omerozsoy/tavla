<?php

namespace App\Services;

use App\Models\MatchResult;
use App\Models\User;
use App\Models\UserWxpTransaction;
use App\Support\StatsConfig;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * WXP (Kazanma Deneyim Puanlari) domain servisi.
 * - award: kazanilan bir mac sonucundan WXP verir. IDEMPOTENT + race-safe:
 *   (match_result_id, source) UNIQUE constraint + transaction. Ayni mac iki kez
 *   islenirse (retry/queue/webhook/concurrent worker) tek WXP olusur.
 * - Ledger source of truth; users.total_wxp yalniz cache (her zaman ledger'dan uretilebilir).
 */
class WxpService
{
    public const SOURCE_MATCH_WIN = 'match_win';

    /**
     * Bir mac sonucu (match_results satiri) icin WXP odullendir.
     * Yalnizca kazanan + desteklenen tur/uzunluk WXP alir. Zaten verilmisse tekrar vermez.
     */
    public function awardForMatchResult(MatchResult $mr): ?UserWxpTransaction
    {
        if (! $mr->won) {
            return null;
        }
        $amount = StatsConfig::wxpForWin($mr->match_type ?? StatsConfig::MATCH_TYPE_MATCH, $mr->match_length);
        if ($amount <= 0) {
            return null; // desteklenmeyen uzunluk -> WXP yok (ilerde config'e eklenebilir)
        }

        return DB::transaction(function () use ($mr, $amount) {
            // Zaten var mi? (idempotent hizli yol)
            $existing = UserWxpTransaction::where('match_result_id', $mr->id)
                ->where('source', self::SOURCE_MATCH_WIN)
                ->first();
            if ($existing) {
                return $existing;
            }

            try {
                $tx = UserWxpTransaction::create([
                    'user_id' => $mr->user_id,
                    'match_result_id' => $mr->id,
                    'amount' => $amount,
                    'source' => self::SOURCE_MATCH_WIN,
                    'metadata' => [
                        'match_length' => $mr->match_length,
                        'match_type' => $mr->match_type ?? StatsConfig::MATCH_TYPE_MATCH,
                    ],
                ]);
            } catch (QueryException $e) {
                // Yaris kosulu: baska islem ayni anda ekledi -> UNIQUE ihlali.
                // Dogal/beklenen durum; hata olarak spamleme, mevcut kaydi don.
                return UserWxpTransaction::where('match_result_id', $mr->id)
                    ->where('source', self::SOURCE_MATCH_WIN)
                    ->first();
            }

            // Cached toplam (ledger source of truth; bu sadece hizli okuma icin).
            User::whereKey($mr->user_id)->increment('total_wxp', $amount);

            return $tx;
        });
    }

    /** Ledger'dan gercek toplam (source of truth). */
    public function totalFromLedger(int $userId): int
    {
        return (int) UserWxpTransaction::where('user_id', $userId)->sum('amount');
    }

    /** Cached users.total_wxp'yi ledger'dan yeniden uret (tek kullanici). */
    public function rebuildTotal(int $userId): int
    {
        $sum = $this->totalFromLedger($userId);
        User::whereKey($userId)->update(['total_wxp' => $sum]);

        return $sum;
    }

    /**
     * Backfill: bir match_results satiri icin ledger kaydi yoksa olustur.
     * $apply=false -> dry-run (yazma yok, olusturulacak amount doner ya da 0).
     */
    public function backfillMatchResult(MatchResult $mr, bool $apply): int
    {
        if (! $mr->won) {
            return 0;
        }
        $amount = StatsConfig::wxpForWin($mr->match_type ?? StatsConfig::MATCH_TYPE_MATCH, $mr->match_length);
        if ($amount <= 0) {
            return 0;
        }
        $exists = UserWxpTransaction::where('match_result_id', $mr->id)
            ->where('source', self::SOURCE_MATCH_WIN)
            ->exists();
        if ($exists) {
            return 0; // zaten var -> idempotent
        }
        if (! $apply) {
            return $amount; // dry-run: olusturulacakti
        }

        try {
            UserWxpTransaction::create([
                'user_id' => $mr->user_id,
                'match_result_id' => $mr->id,
                'amount' => $amount,
                'source' => self::SOURCE_MATCH_WIN,
                'metadata' => [
                    'match_length' => $mr->match_length,
                    'match_type' => $mr->match_type ?? StatsConfig::MATCH_TYPE_MATCH,
                    'backfill' => true,
                ],
            ]);
        } catch (QueryException $e) {
            return 0; // yaris/duplicate -> atla
        }

        return $amount;
    }
}
