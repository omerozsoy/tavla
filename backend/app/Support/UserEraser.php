<?php

namespace App\Support;

use App\Models\Club;
use App\Models\ClubMember;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
            // Takım üyeliği: team_members FK CASCADE YOK (düz kolon) -> silinen/anonimleşen oyuncu
            // takım rosterinde kalır (anonimleşmede 'silinmisN' olarak görünür). Kulüp deseniyle
            // birebir: kurucuysa en eski DİĞER üyeye nazik devir, başka üye yoksa takımı kapat.
            self::detachTeam($user->id);
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
     * Oyuncuyu takımından çıkar ve sayaçları tazele. team_members cascadeOnDelete OLMADIĞI için
     * hem fiziksel silme hem anonimleştirme yolunda ELLE çağrılır (yoksa roster'da hayalet üye kalır).
     * Kurucuysa en eski diğer üyeye devreder; üye kalmazsa takımı kapatır (Club sahiplik devriyle aynı).
     */
    private static function detachTeam(int $userId): void
    {
        if (! Schema::hasTable('team_members')) {
            return;
        }
        $mem = DB::table('team_members')->where('user_id', $userId)->first();
        if (! $mem) {
            return;
        }
        if ($mem->role === 'founder') {
            $next = DB::table('team_members')
                ->where('team_id', $mem->team_id)
                ->where('user_id', '!=', $userId)
                ->orderBy('joined_at')->orderBy('id')
                ->first();
            if ($next) {
                DB::table('team_members')->where('id', $next->id)->update(['role' => 'founder']);
                DB::table('teams')->where('id', $mem->team_id)->update(['founder_id' => $next->user_id]);
            }
        }
        DB::table('team_members')->where('user_id', $userId)->delete();
        // member_count / rating_avg = canlı üyelerden yeniden hesapla (TeamService::recompute ile aynı).
        $agg = DB::table('team_members')
            ->leftJoin('users', 'users.id', '=', 'team_members.user_id')
            ->where('team_members.team_id', $mem->team_id)
            ->selectRaw('COUNT(*) as c, COALESCE(AVG(users.rating), 0) as avg')
            ->first();
        if ((int) $agg->c === 0) {
            DB::table('teams')->where('id', $mem->team_id)->delete(); // üye kalmadı -> takım kapanır
        } else {
            DB::table('teams')->where('id', $mem->team_id)
                ->update(['member_count' => (int) $agg->c, 'rating_avg' => (float) $agg->avg]);
        }
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
            if (! Schema::hasTable($table)) {
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
