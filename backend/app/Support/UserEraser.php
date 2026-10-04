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
 * MALİ GEÇMİŞ (defter/ödeme/sipariş) varsa fiziksel silinmez -> anonymize() (yasal saklama +
 * KVKK silme talebi birlikte karşılanır). User modeli de bu hesapların silinmesini engeller.
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
            if ($user->hasFinancialHistory()) {
                self::anonymize($user);

                return;
            }
            $user->delete();
        });
    }

    /**
     * Mali geçmişi olan hesap: fiziksel silme YERİNE anonimleştirme. Kimlik/iletişim bilgisi ve
     * sosyal veri (mesaj, arkadaşlık, adres, yorum, davet) silinir; hesap kalıcı kapatılır (giriş
     * imkânsız: rastgele şifre + geçersiz e-posta + banned_at). Coin defteri, ödemeler ve siparişler
     * (yasal saklama) ile maç geçmişi (rakiplerin istatistiği) KORUNUR ama artık kimseye bağlanamaz.
     */
    private static function anonymize(User $user): void
    {
        $id = $user->id;
        foreach ([
            'club_members' => ['user_id'],
            'friendships' => ['user_id', 'friend_id'],
            'game_invites' => ['from_user_id', 'to_user_id'],
            'messages' => ['sender_id', 'receiver_id'],
            'message_requests' => ['requester_id', 'target_id'],
            'user_addresses' => ['user_id'],
            'user_blocks' => ['blocker_id', 'blocked_id'],
            'dm_clears' => ['user_id', 'peer_id'],
            'content_comments' => ['user_id'],
            'active_money_match_claims' => ['user_id'],
        ] as $table => $cols) {
            if (! \Illuminate\Support\Facades\Schema::hasTable($table)) {
                continue;
            }
            DB::table($table)->where(function ($q) use ($cols, $id) {
                foreach ($cols as $c) {
                    $q->orWhere($c, $id);
                }
            })->delete();
        }
        $user->forceFill([
            'first_name' => 'Silinmiş',
            'last_name' => 'Üye',
            'nickname' => 'silinmis'.$id,
            'email' => 'deleted-'.$id.'@deleted.invalid',
            'email_verified_at' => null,
            'password' => bin2hex(random_bytes(32)), // 'hashed' cast -> kimsenin bilmediği şifre
            'remember_token' => null,
            'country' => '',
            'province' => null,
            'avatar' => null,
            'avatar_frame' => null,
            'birth_date' => null,
            'phone' => null,
            'phone_verified_at' => null,
            'game_state' => null,
            'last_seen' => null,
            'presence_status' => 'offline',
            'is_admin' => false,
            'plan' => 'free',
            'plan_until' => null,
            'auto_renew' => false,
            'banned_at' => now(),
            'banned_by' => null,
            'ban_reason' => 'account_deleted',
            'ban_note' => null,
        ])->save();
    }
}
