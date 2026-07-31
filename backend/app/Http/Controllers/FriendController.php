<?php

namespace App\Http\Controllers;

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
            ->get(['id', 'first_name', 'nickname', 'avatar', 'rating'])
            ->map(fn ($u) => $this->pub($u));

        // Bana gelen bekleyen istekler
        $incoming = DB::table('friendships')
            ->join('users', 'users.id', '=', 'friendships.user_id')
            ->where('friendships.friend_id', $me)
            ->where('friendships.status', 'pending')
            ->get(['users.id', 'users.first_name', 'users.nickname', 'users.avatar', 'users.rating'])
            ->map(fn ($u) => $this->pub($u));

        return response()->json(['friends' => $friends, 'incoming' => $incoming]);
    }

    // Nick ile arkadaslik istegi gonder
    public function request(Request $request)
    {
        $data = $request->validate(['nickname' => ['required', 'string', 'max:40']]);
        $me = $request->user();

        $target = User::whereRaw('LOWER(nickname) = ?', [strtolower($data['nickname'])])->first();
        if (! $target) {
            return response()->json(['message' => 'Kullanıcı bulunamadı.'], 404);
        }
        if ($target->id === $me->id) {
            return response()->json(['message' => 'Kendini ekleyemezsin.'], 422);
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

        if ($existing) {
            // Karsi taraf zaten bana istek gonderdiyse -> kabul et
            if ($existing->status === 'pending' && $existing->user_id === $target->id) {
                DB::table('friendships')->where('id', $existing->id)->update([
                    'status' => 'accepted', 'updated_at' => now(),
                ]);
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

        return response()->json(['status' => 'pending']);
    }

    // Gelen istegi kabul et (istegi gonderen = $userId)
    public function accept(Request $request, int $userId)
    {
        $me = $request->user()->id;
        $updated = DB::table('friendships')
            ->where('user_id', $userId)
            ->where('friend_id', $me)
            ->where('status', 'pending')
            ->update(['status' => 'accepted', 'updated_at' => now()]);

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

        return response()->json(['ok' => true]);
    }

    private function pub($u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->nickname ?: $u->first_name ?: 'Oyuncu',
            'avatar' => $u->avatar,
            'rating' => $u->rating ?? 1500,
        ];
    }
}
