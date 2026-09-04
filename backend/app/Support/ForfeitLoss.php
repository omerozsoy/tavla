<?php

namespace App\Support;

use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Terk / forfeit ile KAYBEDEN oyuncunun rating + maglubiyet + match_results satirini
 * SUNUCUDA yazar — istemci raporlamasa (sekme kapali/cokme) bile "terk eden kaybeder"
 * rating'e ve sicile yansisin.
 *
 * IDEMPOTENT: (room_code, user_id) icin satir zaten varsa hicbir sey yapmaz
 * (kaybedenin gec gelen client raporu VEYA ikinci forfeit cagrisi cift saymaz).
 * Kaybedenin User satiri lockForUpdate ile kilitlenir -> es zamanli iki forfeit
 * (iki taraftan poll) yarissa yalniz biri yazar.
 *
 * Elo: reportRating ile AYNI (k=32, taban 100). Kaybeden skoru=0.
 */
class ForfeitLoss
{
    /**
     * @param  string  $roomCode   oda kodu (match_results.room_code -> idempotent anahtar)
     * @param  int  $loserId       kaybeden kullanici id
     * @param  int  $oppRating     rakibin (kazananin) rating'i (Elo icin)
     * @param  int|null  $matchLength  mac uzunlugu (puan)
     * @param  string  $matchType   'coin' | 'match'
     * @param  string|null  $winnerName  rakip (kazanan) adi -> gecmiste gorunsun
     */
    public static function record(
        string $roomCode,
        int $loserId,
        int $oppRating,
        ?int $matchLength,
        string $matchType,
        ?string $winnerName,
    ): void {
        if ($loserId <= 0) {
            return; // misafir / hesapsiz -> kaydedecek sicil yok
        }
        // Hizli on-kontrol (kilit almadan): zaten kayitliysa cik.
        if (MatchResult::where('room_code', $roomCode)->where('user_id', $loserId)->exists()) {
            return;
        }

        DB::transaction(function () use ($roomCode, $loserId, $oppRating, $matchLength, $matchType, $winnerName) {
            $loser = User::lockForUpdate()->find($loserId);
            if (! $loser) {
                return;
            }
            // Kilit altinda TEKRAR kontrol (yaris: bu arada baska cagri yazmis olabilir).
            if (MatchResult::where('room_code', $roomCode)->where('user_id', $loserId)->exists()) {
                return;
            }

            $ra = (int) ($loser->rating ?? 1500);
            $rb = $oppRating > 0 ? $oppRating : 1500;
            $expected = 1 / (1 + pow(10, ($rb - $ra) / 400));
            $newRating = max(100, (int) round($ra + 32 * (0 - $expected))); // skor=0 (kayip)

            $loser->rating = $newRating;
            $loser->losses = (int) ($loser->losses ?? 0) + 1;
            $loser->games_played = (int) ($loser->games_played ?? 0) + 1;
            $loser->save();

            $row = [
                'user_id' => $loserId,
                'won' => false,
                'opponent_rating' => $rb,
                'rating_before' => $ra,
                'rating_after' => $newRating,
                'delta' => $newRating - $ra,
                'match_length' => $matchLength,
                'coins_after' => $loser->coins ?? 0,
                'room_code' => $roomCode,
            ];
            if (Schema::hasColumn('match_results', 'opponent_name')) {
                $row['opponent_name'] = $winnerName;
            }
            if (Schema::hasColumn('match_results', 'match_type')) {
                $row['match_type'] = $matchType;
            }
            MatchResult::create($row);
        });
    }
}
