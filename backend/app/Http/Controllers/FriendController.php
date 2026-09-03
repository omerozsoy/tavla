<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FriendController extends Controller
{
    // Kabul edilmis arkadaslar + gelen istekler
    public function index(Request $request)
    {
        $me = $request->user()->id;

        // Karsilikli kabul edilmis arkadaslar (her iki yon)
        $friendIds = DB::table('friendships')
            ->where('status', 'accepted')
            ->where(function ($q) use ($me) {
                $q->where('user_id', $me)->orWhere('friend_id', $me);
            })
            ->get()
            ->map(fn ($r) => $r->user_id === $me ? $r->friend_id : $r->user_id)
            ->unique()
            ->values();

        $friends = User::whereIn('id', $friendIds)
            ->get(['id', 'first_name', 'nickname', 'avatar', 'avatar_frame', 'country', 'rating', 'last_seen'])
            ->map(fn ($u) => $this->pub($u));

        // Bana gelen bekleyen istekler
        $incoming = DB::table('friendships')
            ->join('users', 'users.id', '=', 'friendships.user_id')
            ->where('friendships.friend_id', $me)
            ->where('friendships.status', 'pending')
            ->get(['users.id', 'users.first_name', 'users.nickname', 'users.avatar', 'users.avatar_frame', 'users.country', 'users.rating', 'users.last_seen'])
            ->map(fn ($u) => $this->pub($u));

        return response()->json(['friends' => $friends, 'incoming' => $incoming]);
    }

    // Nick ile arkadaslik istegi gonder
    public function request(Request $request)
    {
        $data = $request->validate([
            'nickname' => ['nullable', 'string', 'max:40'],
            'user_id'  => ['nullable', 'integer'],
        ]);
        $me = $request->user();

        // Once id ile (cevrimici oyuncu paneli gibi), yoksa nickname ile bul.
        $target = ! empty($data['user_id'])
            ? User::find($data['user_id'])
            : (! empty($data['nickname'])
                ? User::whereRaw('LOWER(nickname) = ?', [strtolower($data['nickname'])])->first()
                : null);
        if (! $target) {
            return $this->fail('Kullanıcı bulunamadı.', 404);
        }
        if ($target->id === $me->id) {
            return $this->fail('Kendini ekleyemezsin.', 422);
        }

        // Zaten iliski var mi? (her iki yon)
        $existing = DB::table('friendships')
            ->where(function ($q) use ($me, $target) {
                $q->where('user_id', $me->id)->where('friend_id', $target->id);
            })
            ->orWhere(function ($q) use ($me, $target) {
                $q->where('user_id', $target->id)->where('friend_id', $me->id);
            })
            ->first();

        $meName = $me->nickname ?: $me->first_name ?: 'Bir oyuncu';

        if ($existing) {
            // Karsi taraf zaten bana istek gonderdiyse -> kabul et (karsilikli)
            if ($existing->status === 'pending' && $existing->user_id === $target->id) {
                DB::table('friendships')->where('id', $existing->id)->update([
                    'status' => 'accepted', 'updated_at' => now(),
                ]);
                Notification::notify($target->id, "{$meName} arkadaşlık isteğini kabul etti", null, 'users');
                return response()->json(['status' => 'accepted']);
            }
            return response()->json(['status' => $existing->status]);
        }

        DB::table('friendships')->insert([
            'user_id' => $me->id,
            'friend_id' => $target->id,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Isteği alan kullaniciyi bildirimle uyar (can + toast frontend'de).
        Notification::notify($target->id, "{$meName} sana arkadaşlık isteği gönderdi", null, 'user-plus');

        return response()->json(['status' => 'pending']);
    }

    // Gelen istegi kabul et (istegi gonderen = $userId)
    public function accept(Request $request, int $userId)
    {
        $meUser = $request->user();
        $me = $meUser->id;
        $updated = DB::table('friendships')
            ->where('user_id', $userId)
            ->where('friend_id', $me)
            ->where('status', 'pending')
            ->update(['status' => 'accepted', 'updated_at' => now()]);

        // Isteği gonderen kullaniciyi "kabul edildi" diye uyar.
        if ($updated > 0) {
            $meName = $meUser->nickname ?: $meUser->first_name ?: 'Bir oyuncu';
            Notification::notify($userId, "{$meName} arkadaşlık isteğini kabul etti", null, 'users');
        }

        return response()->json(['ok' => $updated > 0]);
    }

    // Istegi reddet ya da arkadasi sil (her iki yon)
    public function destroy(Request $request, int $userId)
    {
        $me = $request->user()->id;
        DB::table('friendships')
            ->where(function ($q) use ($me, $userId) {
                $q->where('user_id', $me)->where('friend_id', $userId);
            })
            ->orWhere(function ($q) use ($me, $userId) {
                $q->where('user_id', $userId)->where('friend_id', $me);
            })
            ->delete();

        return $this->ok();
    }

    private function pub($u): array
    {
        // Son 70 sn icinde gorulduyse cevrimici
        $online = $u->last_seen && \Illuminate\Support\Carbon::parse($u->last_seen)->gt(now()->subSeconds(70));
        return [
            'id' => $u->id,
            'name' => $u->nickname ?: $u->first_name ?: 'Oyuncu',
            'avatar' => $u->avatar,
            'frame' => $u->avatar_frame ?? null,
            'country' => $u->country ?? null,
            'rating' => $u->rating ?? 1500,
            'online' => (bool) $online,
        ];
    }
}
