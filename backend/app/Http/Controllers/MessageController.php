<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Arkadaslar arasi ozel mesajlasma (DM). Sadece kabul edilmis arkadaslar yazisabilir.
class MessageController extends Controller
{
    // Iki kullanici arkadas mi (kabul edilmis, her iki yon)?
    private function areFriends(int $a, int $b): bool
    {
        return DB::table('friendships')
            ->where('status', 'accepted')
            ->where(function ($q) use ($a, $b) {
                $q->where(function ($x) use ($a, $b) {
                    $x->where('user_id', $a)->where('friend_id', $b);
                })->orWhere(function ($x) use ($a, $b) {
                    $x->where('user_id', $b)->where('friend_id', $a);
                });
            })
            ->exists();
    }

    private function pub(User $u): array
    {
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

    // Konusma listesi (gelen kutusu): mesajlasilan her arkadas + son mesaj + okunmamis sayisi.
    public function threads(Request $request)
    {
        $me = $request->user()->id;

        // Beni iceren mesajlardaki karsi taraf id'leri (en son mesaja gore).
        $partnerIds = Message::query()
            ->where('sender_id', $me)->orWhere('receiver_id', $me)
            ->get(['sender_id', 'receiver_id'])
            ->map(fn ($m) => $m->sender_id === $me ? $m->receiver_id : $m->sender_id)
            ->unique()
            ->values();

        if ($partnerIds->isEmpty()) {
            return response()->json(['threads' => []]);
        }

        $users = User::whereIn('id', $partnerIds)->get()->keyBy('id');

        $threads = $partnerIds->map(function ($pid) use ($me, $users) {
            $u = $users->get($pid);
            if (! $u) {
                return null;
            }
            $last = Message::query()
                ->where(function ($q) use ($me, $pid) {
                    $q->where('sender_id', $me)->where('receiver_id', $pid);
                })
                ->orWhere(function ($q) use ($me, $pid) {
                    $q->where('sender_id', $pid)->where('receiver_id', $me);
                })
                ->orderByDesc('created_at')->orderByDesc('id')
                ->first();
            $unread = Message::where('sender_id', $pid)
                ->where('receiver_id', $me)
                ->whereNull('read_at')
                ->count();

            return [
                'user' => $this->pub($u),
                'last' => $last ? [
                    'body' => $last->body,
                    'mine' => $last->sender_id === $me,
                    'read' => $last->read_at !== null,
                    'created_at' => optional($last->created_at)->toIso8601String(),
                ] : null,
                'unread' => $unread,
                'ts' => optional($last?->created_at)->timestamp ?? 0,
            ];
        })->filter()->sortByDesc('ts')->values()->map(function ($t) {
            unset($t['ts']);

            return $t;
        });

        return response()->json(['threads' => $threads]);
    }

    // Bir arkadasla olan konusma: son 100 mesaj (eskiden yeniye) + gelenleri OKUNDU isaretle.
    public function thread(Request $request, int $userId)
    {
        $me = $request->user()->id;
        if (! $this->areFriends($me, $userId)) {
            return $this->fail('Bu kullanıcı arkadaşın değil.', 403);
        }
        $partner = User::find($userId);
        if (! $partner) {
            return $this->fail('Kullanıcı bulunamadı.', 404);
        }

        $rows = Message::query()
            ->where(function ($q) use ($me, $userId) {
                $q->where('sender_id', $me)->where('receiver_id', $userId);
            })
            ->orWhere(function ($q) use ($me, $userId) {
                $q->where('sender_id', $userId)->where('receiver_id', $me);
            })
            ->orderByDesc('id')->limit(100)->get()->reverse()->values();

        // Karsi taraftan gelen okunmamislari OKUNDU yap.
        Message::where('sender_id', $userId)
            ->where('receiver_id', $me)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $messages = $rows->map(fn ($m) => [
            'id' => $m->id,
            'body' => $m->body,
            'mine' => $m->sender_id === $me,
            'read' => $m->read_at !== null, // gonderdigim mesaj karsi tarafca okundu mu (mavi tik)
            'created_at' => optional($m->created_at)->toIso8601String(),
        ]);

        return response()->json(['user' => $this->pub($partner), 'messages' => $messages]);
    }

    // Arkadasa mesaj gonder.
    public function send(Request $request, int $userId)
    {
        $me = $request->user();
        $data = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
        ]);
        $body = trim($data['body']);
        if ($body === '') {
            return $this->fail('Mesaj boş olamaz.', 422);
        }
        if (! $this->areFriends($me->id, $userId)) {
            return $this->fail('Bu kullanıcı arkadaşın değil.', 403);
        }

        $msg = Message::create([
            'sender_id' => $me->id,
            'receiver_id' => $userId,
            'body' => $body,
            'read_at' => null,
            'created_at' => now(),
        ]);

        // NOT: Mesaj icin AYRI bildirim (can/zil) OLUSTURULMAZ -> mesaj+bildirim cift
        // uyari olmasin. Alici, sag ust chat ikonundaki okunmamis rozetinden (dm_unread,
        // ping) haberdar olur.

        return response()->json([
            'message' => [
                'id' => $msg->id,
                'body' => $msg->body,
                'mine' => true,
                'read' => false, // yeni gonderildi, henuz okunmadi
                'created_at' => optional($msg->created_at)->toIso8601String(),
            ],
        ]);
    }

    // Toplam okunmamis mesaj sayisi (rozet). ping'e de eklenir.
    public function unread(Request $request)
    {
        $me = $request->user()->id;
        $count = Message::where('receiver_id', $me)->whereNull('read_at')->count();

        return response()->json(['unread' => $count]);
    }
}
