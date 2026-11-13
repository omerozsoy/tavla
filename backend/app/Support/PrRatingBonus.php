<?php

namespace App\Support;

use App\Models\MatchResult;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * PR ×2 ÖDÜLÜ: online PUANLI maçta HEM maçı kazanan HEM de PR'ı rakibinden KESİNLİKLE düşük
 * (= daha iyi oynayan) oyuncu, kazandığı rating'in bir katı daha alır -> toplam ×2. Kaybeden
 * DEĞİŞMEZ (ödül mantığı, sıfır-toplam DEĞİL — kullanıcı direktifi 2026-11-13).
 *
 * Rating maç biter bitmez (reportRating) işlenir ama PR'lar async gelir (gnubg). İki oyuncunun da
 * otoriter PR'ını TEK geçişte AnalyzeMatchSnowieJob yazar -> bonus değerlendirmesi için TEK doğru yer
 * orasıdır (bu sınıfı oradan çağır). Idempotent: KAZANAN satırının pr_rating_bonus'u NULL ise bir kez
 * değerlendirir (0 = ödül yok, >0 = verildi); heal/backfill yeniden çağırsa bir daha dokunmaz.
 */
class PrRatingBonus
{
    public static function apply(string $roomCode): void
    {
        if ($roomCode === '' || ! Schema::hasColumn('match_results', 'pr_rating_bonus')) {
            return;
        }
        try {
            // Yalnız iki-hesaplı online maç (pvb/misafir/tek satır -> rakip PR'ı adil kıyaslanamaz: ödül yok).
            $rows = MatchResult::where('room_code', $roomCode)
                ->where('user_id', '>', 0)
                ->get(['id', 'user_id', 'won', 'rated', 'delta', 'rating_after', 'gnubg_pr', 'pr_rating_bonus']);
            if ($rows->count() !== 2) {
                return;
            }
            $winner = $rows->firstWhere('won', true);
            $loser = $rows->firstWhere('won', false);
            if (! $winner || ! $loser) {
                return;
            }
            if ($winner->pr_rating_bonus !== null) {
                return; // zaten değerlendirildi (idempotent)
            }
            if ($winner->gnubg_pr === null || $loser->gnubg_pr === null) {
                return; // iki PR da hazır değil -> sonraki Snowie/heal denemesini bekle
            }

            $eligible = (bool) $winner->rated
                && (int) $winner->delta > 0
                && (float) $winner->gnubg_pr < (float) $loser->gnubg_pr;

            $bonus = 0;
            if ($eligible && ($u = User::find($winner->user_id))) {
                $bonus = (int) $winner->delta; // kazancı ikiye katla: bir delta daha ekle
                $u->rating = (int) $u->rating + $bonus;
                $u->save();
                MatchResult::where('id', $winner->id)->update([
                    'rating_after' => (int) $winner->rating_after + $bonus,
                    'delta' => (int) $winner->delta + $bonus,
                    'pr_rating_bonus' => $bonus,
                ]);
                Log::info('PR rating bonus verildi (x2)', [
                    'room' => $roomCode, 'user' => $winner->user_id, 'bonus' => $bonus,
                    'winner_pr' => $winner->gnubg_pr, 'loser_pr' => $loser->gnubg_pr,
                ]);
            } else {
                MatchResult::where('id', $winner->id)->update(['pr_rating_bonus' => 0]); // değerlendirildi, ödül yok
            }
        } catch (\Throwable $e) {
            Log::warning('PR rating bonus hata (yok sayildi)', ['room' => $roomCode, 'err' => $e->getMessage()]);
        }
    }
}
