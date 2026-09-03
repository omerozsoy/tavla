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

        // Oynanmayi bekleyen turnuva maclarim (her iki oyuncu var, sonuc yok)
        $tmatches = [];
        $running = \App\Models\Tournament::where('status', 'running')->get();
        foreach ($running as $tr) {
            $inThis = false;
            foreach (($tr->players ?? []) as $p) {
                if (($p['id'] ?? null) === $me->id) {
                    $inThis = true;
                    break;
                }
            }
            if (! $inThis) {
                continue;
            }
            foreach (($tr->bracket ?? []) as $round) {
                foreach ($round as $m) {
                    $p1 = $m['p1']['id'] ?? null;
                    $p2 = $m['p2']['id'] ?? null;
                    if (empty($m['winner']) && $p1 && $p2 && ($p1 === $me->id || $p2 === $me->id)) {
                        $opp = $p1 === $me->id ? $m['p2'] : $m['p1'];
                        $tmatches[] = [
                            'tid' => $tr->id,
                            'tname' => $tr->name,
                            'match' => $m['key'],
                            'oppId' => $opp['id'],
                            'oppName' => $opp['name'] ?? 'Rakip',
                        ];
                    }
                }
            }
        }

        // 6 saatlik odul hazir mi + sonraki odule kalan saniye
        // abs(): Carbon 3'te diffInSeconds isaretli doner -> mutlak gecen sure al
        $last = $me->last_reward ? \Illuminate\Support\Carbon::parse($me->last_reward) : null;
        $elapsed = $last ? (int) abs(now()->diffInSeconds($last)) : PHP_INT_MAX;
        $rewardReady = $elapsed >= 6 * 3600;
        $rewardSeconds = $rewardReady ? 0 : (6 * 3600 - $elapsed);

        // Bildirimler (son 20) + okunmamis sayisi
        $notifications = \App\Models\Notification::where('user_id', $me->id)
            ->orderByDesc('id')
            ->limit(20)
            ->get(['id', 'title', 'body', 'icon', 'read', 'created_at'])
            ->map(fn ($n) => [
                'id' => $n->id,
                'title' => $n->title,
                'body' => $n->body,
                'icon' => $n->icon,
                'read' => (bool) $n->read,
                'created_at' => optional($n->created_at)->toIso8601String(),
            ]);
        $unread = \App\Models\Notification::where('user_id', $me->id)->where('read', false)->count();
        // Okunmamis ozel mesaj sayisi (mesaj rozeti)
        $dmUnread = \App\Models\Message::where('receiver_id', $me->id)->whereNull('read_at')->count();

        return response()->json([
            'invites' => $invites,
            'tournament_matches' => $tmatches,
            'reward_ready' => $rewardReady,
            'reward_seconds' => $rewardSeconds,
            'coins' => $me->coins ?? 0,
            'notifications' => $notifications,
            'unread' => $unread,
            'dm_unread' => $dmUnread,
        ]);
    }

    // Bildirimleri OKUNDU isaretle (hepsi veya verilen id'ler). Silinmez -> kullanici
    // profilinde gormeye devam eder; rozet (unread) 0'a duser. Silme ayri (deleteNotifications).
    public function readNotifications(Request $request)
    {
        $me = $request->user();
        $data = $request->validate([
            'ids' => ['nullable', 'array'],
            'ids.*' => ['integer'],
        ]);
        $q = \App\Models\Notification::where('user_id', $me->id)->where('read', false);
        if (! empty($data['ids'])) {
            $q->whereIn('id', $data['ids']);
        }
        $q->update(['read' => true]);

        return $this->ok();
    }

    // Bildirimleri SIL (tek tek: ids verilir; toplu: ids bos -> hepsi). Profil ekranindan.
    public function deleteNotifications(Request $request)
    {
        $me = $request->user();
        $data = $request->validate([
            'ids' => ['nullable', 'array'],
            'ids.*' => ['integer'],
        ]);
        $q = \App\Models\Notification::where('user_id', $me->id);
        if (! empty($data['ids'])) {
            $q->whereIn('id', $data['ids']);
        }
        $q->delete();

        return $this->ok();
    }

    // Bir arkadasi oyuna davet et -> paylasimli oda kodu uret, davet olustur
    public function invite(Request $request, int $userId)
    {
        $me = $request->user();
        if ($userId === $me->id) {
            return $this->fail('Kendini davet edemezsin.', 422);
        }
        if (! User::where('id', $userId)->exists()) {
            return $this->fail('Kullanıcı bulunamadı.', 404);
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
            return $this->fail('Davet bulunamadı.', 404);
        }
        DB::table('game_invites')->where('id', $inviteId)->update([
            'status' => $data['accept'] ? 'accepted' : 'declined',
            'updated_at' => now(),
        ]);
        return response()->json(['code' => $data['accept'] ? $invite->room_code : null]);
    }
}
