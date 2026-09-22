<?php

namespace App\Support;

use App\Models\Club;
use App\Models\ClubMember;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Kullanıcı silme TEK SÖZLEŞMESİ — deleteAccount (KVKK self-sil) + PurgeTestAccounts (CLI) +
 * admin panel çoklu-silme AYNI mantığı kullanır (üç kopya drift etmesin).
 *
 * - Kulüp SAHİBİYSE: en eski DİĞER üyeye nazik devir; başka üye yoksa kulübü kapat. Aksi halde
 *   clubs.owner_id cascadeOnDelete tüm kulübü (+ üyeleri) uçururdu -> masum üyeler kulüpsüz kalır.
 * - Üye olduğu kulübün members_count'ını düşür (üyeliği cascade ile silinecek).
 * - FK'siz notifications + oturum token'ları ELLE; sonra user->delete (match_results/blunders/
 *   clubs/club_members/friendships/payments FK cascadeOnDelete ile otomatik).
 *
 * Her çağrı KENDİ transaction'ında (çağıran bir tx içindeyse nested = savepoint, güvenli).
 * NOT: is_admin KORUMASI burada YOK — çağıran karar verir (self-sil kendini siler; toplu-silme
 * adminleri atlar). Eraser "ne verilirse onu güvenli siler".
 */
class UserEraser
{
    public static function erase(User $user): void
    {
        DB::transaction(function () use ($user) {
            // Kulüp sahipliği nazik devir (leave()/deleteAccount ile birebir).
            foreach (Club::where('owner_id', $user->id)->get() as $club) {
                $next = ClubMember::where('club_id', $club->id)
                    ->where('user_id', '!=', $user->id)
                    ->orderBy('created_at')
                    ->first();
                if ($next) {
                    $next->update(['role' => 'owner']);
                    $club->update(['owner_id' => $next->user_id]);
                } else {
                    $club->delete(); // başka üye yok -> kulüp kapanır
                }
            }
            // Üye olduğu kulüp hâlâ duruyorsa üye sayısını düşür (üyeliği cascade silinecek).
            $myMem = ClubMember::where('user_id', $user->id)->first();
            if ($myMem && Club::whereKey($myMem->club_id)->exists()) {
                Club::whereKey($myMem->club_id)->decrement('members_count');
            }
            Notification::where('user_id', $user->id)->delete();
            $user->tokens()->delete();
            $user->delete();
        });
    }
}
