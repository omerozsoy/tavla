<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PresenceController extends Controller
{
    // Kalp atisi: cevrimici tut + bekleyen davetleri dondur (istemci periyodik cagirir)
    public function ping(Request $request)
    {
        $me = $request->user();
        $me->last_seen = now();
        $me->save();

        $invites = DB::table('game_invites')
            ->join('users', 'users.id', '=', 'game_invites.from_user_id')
            ->where('game_invites.to_user_id', $me->id)
            ->where('game_invites.status', 'pending')
            ->where('game_invites.created_at', '>', now()->subMinutes(2))
            ->get([
                'game_invites.id',
                'game_invites.room_code as code',
                'users.first_name',
                'users.nickname',
                'users.avatar',
            ])
            ->map(fn ($r) => [
                'id' => $r->id,
                'code' => $r->code,
                'from' => $r->nickname ?: $r->first_name ?: 'Oyuncu',
                'avatar' => $r->avatar,
            ]);

        return response()->json(['invites' => $invites]);
    }

    // Bir arkadasi oyuna davet et -> paylasimli oda kodu uret, davet olustur
    public function invite(Request $request, int $userId)
    {
        $me = $request->user();
        if ($userId === $me->id) {
            return response()->json(['message' => 'Kendini davet edemezsin.'], 422);
        }
        if (! User::where('id', $userId)->exists()) {
            return response()->json(['message' => 'Kullanıcı bulunamadı.'], 404);
        }

        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $code = '';
            for ($i = 0; $i < 5; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (Room::where('code', $code)->exists());

        // Onceki bekleyen davetleri (ayni ikiliye) temizle
        DB::table('game_invites')
            ->where('from_user_id', $me->id)
            ->where('to_user_id', $userId)
            ->where('status', 'pending')
            ->delete();

        DB::table('game_invites')->insert([
            'from_user_id' => $me->id,
            'to_user_id' => $userId,
            'room_code' => $code,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['code' => $code]);
    }

    public function respond(Request $request, int $inviteId)
    {
        $data = $request->validate(['accept' => ['required', 'boolean']]);
        $me = $request->user()->id;
        $invite = DB::table('game_invites')->where('id', $inviteId)->where('to_user_id', $me)->first();
        if (! $invite) {
            return response()->json(['message' => 'Davet bulunamadı.'], 404);
        }
        DB::table('game_invites')->where('id', $inviteId)->update([
            'status' => $data['accept'] ? 'accepted' : 'declined',
            'updated_at' => now(),
        ]);
        return response()->json(['code' => $data['accept'] ? $invite->room_code : null]);
    }
}
