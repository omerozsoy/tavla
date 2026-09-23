<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PresenceController extends Controller
{
    // Kalp atisi: cevrimici tut + bekleyen davetleri dondur (istemci periyodik cagirir)
    public function ping(Request $request)
    {
        $me = $request->user();
        $me->last_seen = now();
        $me->save();

        // BAYAT DAVET KALKANI: davet YALNIZCA davet edenin odası HÂLÂ 'waiting' iken canlıdır.
        // Oda silinmiş/başlamış/bitmiş (davet eden iptal etti, ayrıldı ya da başka maça geçti) ise
        // rooms join'i düşer -> davet o an banner'dan kalkar (açık iptal beklemeden). +status pending
        // +2dk pencere backstop. Böylece "kabul ettim saçma sayfaya gitti" (ölü oda) tekrarlanmaz.
        $invites = DB::table('game_invites')
            ->join('users', 'users.id', '=', 'game_invites.from_user_id')
            ->join('rooms', 'rooms.code', '=', 'game_invites.room_code')
            ->where('rooms.status', 'waiting')
            ->where('game_invites.to_user_id', $me->id)
            ->where('game_invites.status', 'pending')
            ->where('game_invites.created_at', '>', now()->subMinutes(2))
            ->get([
                'game_invites.id',
                'game_invites.room_code as code',
                'game_invites.target',
                'game_invites.time_control',
                'users.first_name',
                'users.nickname',
                'users.avatar',
            ])
            ->map(fn ($r) => [
                'id' => $r->id,
                'code' => $r->code,
                'from' => $r->nickname ?: $r->first_name ?: 'Oyuncu',
                'avatar' => $r->avatar,
                'target' => (int) ($r->target ?? 1),
                'timeControl' => $r->time_control,
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
        // 6 saatlik ödül MİKTARI (plana + admin ayarına göre): premium 50, normal 25 (Site Ayarları).
        $rewardCoins = in_array($me->plan_active, ['star', 'starpro'], true)
            ? \App\Models\Setting::int('reward_premium', 50)
            : \App\Models\Setting::int('reward_normal', 25);

        // Bildirimler (son 20) + okunmamis sayisi. action/actor_id kolonu canlida henuz migrate
        // edilmemis olabilir -> varsa sec (eyleme donuk "Kabul Et" butonu icin).
        $hasAction = Schema::hasColumn('notifications', 'action');
        $notifCols = $hasAction
            ? ['id', 'title', 'body', 'icon', 'action', 'actor_id', 'read', 'created_at']
            : ['id', 'title', 'body', 'icon', 'read', 'created_at'];
        $notifications = \App\Models\Notification::where('user_id', $me->id)
            ->orderByDesc('id')
            ->limit(20)
            ->get($notifCols)
            ->map(fn ($n) => [
                'id' => $n->id,
                'title' => $n->title,
                'body' => $n->body,
                'icon' => $n->icon,
                'action' => $hasAction ? $n->action : null,
                'actor_id' => $hasAction ? ($n->actor_id !== null ? (int) $n->actor_id : null) : null,
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
            'reward_coins' => $rewardCoins,
            'coins' => $me->coins ?? 0,
            'notifications' => $notifications,
            'unread' => $unread,
            'dm_unread' => $dmUnread,
            'status' => $me->presence_status ?: 'available', // kendi durumu (durum secici senkron)
        ]);
    }

    // Oyuncu kendi DURUMUNU degistirir: available (Musait) | ready (Oyuna Hazir) |
    // busy (Oyun Kabul Etmiyor) | offline (Cevrimdisi Gorun). offline -> cevrimici
    // listesinde gorunmez; busy/offline -> maca davet edilemez (invite() engeller).
    public function setStatus(Request $request)
    {
        $data = $request->validate([
            'status' => ['required', 'in:available,ready,busy,offline'],
        ]);
        $me = $request->user();
        $me->last_seen = now(); // durum degisimi = aktivite
        // Kolon henuz migrate edilmemisse durumu kaydetme (500 verme); yine de istenen
        // degeri dondur ki arayuz kirilmasin. Migrate kosunca kalici olur.
        if (Schema::hasColumn('users', 'presence_status')) {
            $me->presence_status = $data['status'];
        }
        $me->save();

        return response()->json(['status' => $data['status']]);
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
        // Davet ile tasinan oyun ayarlari: target=1 -> Tek Oyun; >1 -> Mac uzunlugu (puan).
        // time_control: casual | normal | speed. (Davetli neye davet edildigini gorsun.)
        $settings = $request->validate([
            'target' => ['nullable', 'integer', 'min:1', 'max:25'],
            'time_control' => ['nullable', 'in:casual,normal,speed'],
        ]);
        $target = User::find($userId);
        if (! $target) {
            return $this->fail('Kullanıcı bulunamadı.', 404);
        }
        // "Oyun Kabul Etmiyor" (busy) veya "Çevrimdışı Görün" (offline) durumundaki
        // oyuncu maça davet edilemez -> davet eden dostça uyarilir.
        if (in_array($target->presence_status, ['busy', 'offline'], true)) {
            return $this->fail('Bu oyuncu şu anda oyun kabul etmiyor.', 409);
        }

        // Zaten aktif bir maçta olan oyuncu daveti kabul edemez (maç ortasında). Davet eden dostça
        // uyarilir. updated_at 3dk guard'i: yalnizca GERCEKTEN aktif maclar (yarim kalmis/hayalet
        // 'playing' odalar sayilmaz). Bot maci dahil -> oyuncu her turlu mesgul.
        $inMatch = Room::where('status', 'playing')
            ->where('updated_at', '>', now()->subMinutes(3))
            ->where(function ($q) use ($userId) {
                $q->where('p1_user_id', $userId)->orWhere('p2_user_id', $userId);
            })
            ->exists();
        if ($inMatch) {
            return $this->fail('Davet ettiğiniz oyuncu aktif maçta.', 409);
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
            'target' => $settings['target'] ?? 1,
            'time_control' => $settings['time_control'] ?? null,
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

        // Reddetme: durumu isaretle, cik.
        if (! $data['accept']) {
            DB::table('game_invites')->where('id', $inviteId)->update([
                'status' => 'declined',
                'updated_at' => now(),
            ]);
            return response()->json([
                'code' => null,
                'target' => (int) ($invite->target ?? 1),
                'timeControl' => $invite->time_control,
            ]);
        }

        // KABUL: davet edenin odasi HALA var ve katilima acik olmali. Aksi halde davetli
        // enter() ile KENDINI p1 yapan bos bir oda kurup tek basina takilir -> kullanicinin
        // gozunde "kabul ettim hicbir sey olmadi". Davet eden ayrilmis / davetini iptal etmis /
        // oda dolmus / maca baslamissa dostca uyar ve daveti 'expired' yap (banner geri gelmesin).
        $room = Room::where('code', $invite->room_code)->first();
        $joinable = $room
            && $room->status === 'waiting'
            && $room->p1_token          // davet eden hala p1 slotunda
            && ! $room->p2_token;       // ikinci slot bos
        if (! $joinable) {
            DB::table('game_invites')->where('id', $inviteId)->update([
                'status' => 'expired',
                'updated_at' => now(),
            ]);
            return $this->fail('Davet eden oyundan ayrıldı. Tekrar davet iste.', 409);
        }

        DB::table('game_invites')->where('id', $inviteId)->update([
            'status' => 'accepted',
            'updated_at' => now(),
        ]);
        return response()->json([
            'code' => $invite->room_code,
            // Kabulde AYNI ayarla odaya gir: davet edenin sectigi Tek Oyun/Mac uzunlugu + saat.
            'target' => (int) ($invite->target ?? 1),
            'timeControl' => $invite->time_control,
        ]);
    }

    // Davet EDEN daveti iptal eder (bekleme ekraninda "Oyunu Iptal Et"): bu oda koduna ait
    // KENDI bekleyen davet(ler)ini sil -> alicinin daveti banner'i bir sonraki /ping poll'unda
    // KALKAR (frontend setInvites listeyi degistirir; kabul edilmis/bitmis davet etkilenmez).
    public function cancelInvite(Request $request)
    {
        $me = $request->user();
        $data = $request->validate(['code' => ['required', 'string', 'max:12']]);
        DB::table('game_invites')
            ->where('from_user_id', $me->id)
            ->where('room_code', $data['code'])
            ->where('status', 'pending')
            ->delete();

        return response()->json(['ok' => true]);
    }
}
