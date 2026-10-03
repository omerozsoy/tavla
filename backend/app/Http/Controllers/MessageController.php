<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Ozel mesajlasma (DM). Arkadaslar dogrudan yazisir. Arkadas OLMAYAN birine
// yazilinca konusma aliciya "istek" (message request) olarak duser: alici kabul
// edene ya da cevap yazana kadar normal gelen kutusuna girmez. Boylece herkes
// yazabilir ama istenmeyen kisiler istek kutusunda kalir / reddedilebilir.
class MessageController extends Controller
{
    // Bir istek onaylanana kadar gonderen en fazla bu kadar mesaj atabilir (flood korumasi).
    private const MAX_PENDING_MSGS = 5;

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

    // requester -> target yonundeki istek satiri (yoksa null).
    private function reqRow(int $requester, int $target): ?object
    {
        return DB::table('message_requests')
            ->where('requester_id', $requester)
            ->where('target_id', $target)
            ->first();
    }

    // Iki kullanici arasindaki konusma "acik" mi (normal gelen kutusu, serbest yazisma)?
    // Acik = arkadaslar VEYA iki yonden birinde kabul edilmis istek.
    private function isOpen(int $me, int $other): bool
    {
        if ($this->areFriends($me, $other)) {
            return true;
        }
        // Resmi/sistem hesabı ("Tavla TV Yönetim") ile konuşma DAİMA açıktır (istek kutusuna
        // düşmez): panelden gelen duyurular oyuncunun normal gelen kutusunda görünür, oyuncu
        // doğrudan cevap yazabilir.
        if (Schema::hasColumn('users', 'is_system')
            && User::whereIn('id', [$me, $other])->where('is_system', true)->exists()) {
            return true;
        }
        $out = $this->reqRow($me, $other);
        $in = $this->reqRow($other, $me);

        return ($out && $out->status === 'accepted') || ($in && $in->status === 'accepted');
    }

    // İki kullanıcı arasında (HERHANGİ yönde) blok var mı? -> mesajlaşma engellenir.
    private function blockedBetween(int $a, int $b): bool
    {
        if (! Schema::hasTable('user_blocks')) {
            return false;
        }

        return DB::table('user_blocks')
            ->where(function ($q) use ($a, $b) {
                $q->where('blocker_id', $a)->where('blocked_id', $b);
            })
            ->orWhere(function ($q) use ($a, $b) {
                $q->where('blocker_id', $b)->where('blocked_id', $a);
            })
            ->exists();
    }

    // Ben (me) bu peer'i blokladım mı? (kebab etiketi: "Blokla" / "Blok kaldır").
    private function iBlocked(int $me, int $peer): bool
    {
        if (! Schema::hasTable('user_blocks')) {
            return false;
        }

        return DB::table('user_blocks')->where('blocker_id', $me)->where('blocked_id', $peer)->exists();
    }

    // "Sohbeti sil" damgam: bu ID'ye KADAR (<=) mesajlar bana gizli (karşı taraf etkilenmez). Yoksa 0.
    private function clearedMsgId(int $me, int $peer): int
    {
        if (! Schema::hasTable('dm_clears')) {
            return 0;
        }

        return (int) (DB::table('dm_clears')->where('user_id', $me)->where('peer_id', $peer)->value('cleared_msg_id') ?? 0);
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
            'premium' => $u->plan_active !== 'free', // süresi geçerli ücretli plan -> PREMIUM
        ];
    }

    // Konusma listesi (gelen kutusu). Her konusma icin "request" bayragi: bu, BENIM
    // onayimi bekleyen gelen bir istek mi (arkadas degiliz + karsi taraf bana yazmis,
    // ben henuz kabul/cevap etmemisim). Reddettigim istekler listede GORUNMEZ.
    public function threads(Request $request)
    {
        $me = $request->user()->id;

        $partnerIds = Message::query()
            ->where('sender_id', $me)->orWhere('receiver_id', $me)
            ->get(['sender_id', 'receiver_id'])
            ->map(fn ($m) => $m->sender_id === $me ? $m->receiver_id : $m->sender_id)
            ->unique()
            ->values();

        if ($partnerIds->isEmpty()) {
            return response()->json(['threads' => [], 'requestCount' => 0]);
        }

        $users = User::whereIn('id', $partnerIds)->get()->keyBy('id');
        $hasImageCol = Schema::hasColumn('messages', 'image');
        // Kebab: "Sohbeti sil" damgaları (peer_id => cleared_at) + blokladıklarım (peer_id set). Batch (N+1 yok).
        $myClears = Schema::hasTable('dm_clears')
            ? DB::table('dm_clears')->where('user_id', $me)->whereIn('peer_id', $partnerIds)->pluck('cleared_msg_id', 'peer_id')
            : collect();
        $myBlocks = Schema::hasTable('user_blocks')
            ? DB::table('user_blocks')->where('blocker_id', $me)->whereIn('blocked_id', $partnerIds)->pluck('blocked_id')->flip()
            : collect();

        // Ilgili istek satirlarini tek seferde cek (N+1 olmasin).
        $reqRows = DB::table('message_requests')
            ->where(function ($q) use ($me, $partnerIds) {
                $q->where('requester_id', $me)->whereIn('target_id', $partnerIds);
            })
            ->orWhere(function ($q) use ($me, $partnerIds) {
                $q->where('target_id', $me)->whereIn('requester_id', $partnerIds);
            })
            ->get();
        // out[other] = benim ona gonderdigim istek; in[other] = onun bana gonderdigi istek.
        $out = [];
        $in = [];
        foreach ($reqRows as $r) {
            if ($r->requester_id === $me) {
                $out[$r->target_id] = $r;
            } else {
                $in[$r->requester_id] = $r;
            }
        }

        $threads = $partnerIds->map(function ($pid) use ($me, $users, $out, $in, $hasImageCol, $myClears, $myBlocks) {
            $u = $users->get($pid);
            if (! $u) {
                return null;
            }
            $clr = (int) ($myClears[$pid] ?? 0); // "Sohbeti sil": bu ID'ye kadar mesajlar bana gizli
            $inRow = $in[$pid] ?? null;
            // Reddettigim gelen istek -> konusmayi gizle.
            if ($inRow && $inRow->status === 'declined') {
                return null;
            }
            $friends = $this->areFriends($me, $pid);
            $outRow = $out[$pid] ?? null;
            $open = $friends
                || ($u->is_system ?? false) // resmi/sistem hesabı: konuşma daima açık
                || ($outRow && $outRow->status === 'accepted')
                || ($inRow && $inRow->status === 'accepted');
            // Onayimi bekleyen gelen istek mi?
            $isRequest = ! $open && $inRow && $inRow->status === 'pending';

            // Liste önizlemesi: AĞIR base64 image blob'unu ÇEKME (thread listesi MB'larca şişerdi);
            // yalnız gerekli kolonlar + hafif has_image ifadesi.
            $lastCols = ['id', 'body', 'sender_id', 'read_at', 'created_at'];
            if ($hasImageCol) {
                $lastCols[] = DB::raw("(image IS NOT NULL AND image <> '') AS has_image");
            }
            $last = Message::query()
                ->where(function ($q) use ($me, $pid) {
                    $q->where(function ($x) use ($me, $pid) {
                        $x->where('sender_id', $me)->where('receiver_id', $pid);
                    })->orWhere(function ($x) use ($me, $pid) {
                        $x->where('sender_id', $pid)->where('receiver_id', $me);
                    });
                })
                ->when($clr, fn ($q) => $q->where('id', '>', $clr)) // silinen (eski) mesajları atla
                ->orderByDesc('created_at')->orderByDesc('id')
                ->first($lastCols);
            // Sohbeti sildim + sonrasında yeni mesaj YOK -> listede GÖSTERME (yeni mesaj gelince döner).
            if (! $last) {
                return null;
            }
            $unread = Message::where('sender_id', $pid)
                ->where('receiver_id', $me)
                ->whereNull('read_at')
                ->when($clr, fn ($q) => $q->where('id', '>', $clr))
                ->count();

            return [
                'user' => $this->pub($u),
                'last' => $last ? [
                    'body' => $last->body,
                    'has_image' => (bool) ($last->has_image ?? false), // liste önizlemesi "📷 Görsel"
                    'mine' => $last->sender_id === $me,
                    'read' => $last->read_at !== null,
                    'created_at' => optional($last->created_at)->toIso8601String(),
                ] : null,
                'unread' => $unread,
                'request' => $isRequest, // BENIM onayimi bekleyen gelen istek
                'blocked' => isset($myBlocks[$pid]), // ben bu kullanıcıyı blokladım mı (kebab etiketi)
                'ts' => optional($last?->created_at)->timestamp ?? 0,
            ];
        })->filter()->sortByDesc('ts')->values()->map(function ($t) {
            unset($t['ts']);

            return $t;
        });

        $requestCount = $threads->where('request', true)->count();

        return response()->json(['threads' => $threads, 'requestCount' => $requestCount]);
    }

    // Bir konusma: son 100 mesaj (eskiden yeniye) + gelenleri OKUNDU isaretle.
    // Artik arkadas olmayanlarla da acilabilir (istek akisi). Okumak istegi ONAYLAMAZ;
    // onay ayri (accept ya da cevap yazmak).
    public function thread(Request $request, int $userId)
    {
        $me = $request->user()->id;
        $partner = User::find($userId);
        if (! $partner) {
            return $this->fail('Kullanıcı bulunamadı.', 404);
        }

        $clr = $this->clearedMsgId($me, $userId); // "Sohbeti sil": bu ID'ye kadar mesajlar bana gizli
        $rows = Message::query()
            ->where(function ($q) use ($me, $userId) {
                $q->where(function ($x) use ($me, $userId) {
                    $x->where('sender_id', $me)->where('receiver_id', $userId);
                })->orWhere(function ($x) use ($me, $userId) {
                    $x->where('sender_id', $userId)->where('receiver_id', $me);
                });
            })
            ->when($clr, fn ($q) => $q->where('id', '>', $clr))
            ->orderByDesc('id')->limit(100)->get()->reverse()->values();

        // Karsi taraftan gelen okunmamislari OKUNDU yap.
        Message::where('sender_id', $userId)
            ->where('receiver_id', $me)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $hasImageCol = Schema::hasColumn('messages', 'image');
        $messages = $rows->map(fn ($m) => [
            'id' => $m->id,
            'body' => $m->body,
            'image' => $hasImageCol ? ($m->image ?? null) : null,
            'mine' => $m->sender_id === $me,
            'read' => $m->read_at !== null, // gonderdigim mesaj karsi tarafca okundu mu (mavi tik)
            'created_at' => optional($m->created_at)->toIso8601String(),
        ]);

        // Karsi taraf su an bana yaziyor mu? (typing heartbeat cache'i, 6 sn TTL)
        $typing = (bool) Cache::get("dm-typing:{$userId}:{$me}");

        // Bu konusma benim onayimi bekleyen bir istek mi? (banner icin)
        $inRow = $this->reqRow($userId, $me);
        $isRequest = ! $this->isOpen($me, $userId) && $inRow && $inRow->status === 'pending';

        return response()->json([
            'user' => $this->pub($partner),
            'messages' => $messages,
            'typing' => $typing,
            'request' => $isRequest,
            'blocked' => $this->iBlocked($me, $userId), // ben bu kullanıcıyı blokladım mı
        ]);
    }

    // "Yaziyor…" nabzi. Konusma acik degilse (henuz istek) sessizce yok say.
    public function typing(Request $request, int $userId)
    {
        $me = $request->user()->id;
        if (! $this->areFriends($me, $userId) && ! $this->reqRow($me, $userId) && ! $this->reqRow($userId, $me)) {
            return response()->json(['ok' => false]); // alakasiz kisi -> sessiz gec
        }
        Cache::put("dm-typing:{$me}:{$userId}", 1, now()->addSeconds(6));

        return response()->json(['ok' => true]);
    }

    // Mesaj gonder. Arkadassak/konusma acikssa serbest. Degilsek istek akisi:
    //  - karsi taraf bana zaten istek atmissa, CEVAP yazmak istegi ONAYLAR (acilir).
    //  - ben ona ilk kez yaziyorsam pending istek olusur; onaylanana kadar en fazla
    //    MAX_PENDING_MSGS mesaj (flood korumasi).
    //  - karsi taraf istegimi reddettiyse gonderemem.
    public function send(Request $request, int $userId)
    {
        $me = $request->user();
        $hasImageCol = Schema::hasColumn('messages', 'image');
        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:4000'],
            // GÖRSEL: base64 data-URL (avatar deseni, daha büyük limit; istemci sıkıştırır).
            'image' => ['nullable', 'string', 'max:3000000', 'starts_with:data:image/'],
        ]);
        $body = trim((string) ($data['body'] ?? ''));
        $image = $hasImageCol ? ($data['image'] ?? null) : null;
        if ($body === '' && ! $image) {
            return $this->fail('Mesaj boş olamaz.', 422); // metin VEYA görsel gerekli
        }

        // KÜFÜR YAPTIRIMI (oyun içi sohbetle ortak): yasaklıysa engelle; değilse metni süz,
        // küfür varsa **** maskele + artan konuşma yasağı uygula + uyarı döndür.
        if (($left = \App\Support\ChatModeration::mutedSeconds($me)) !== null) {
            return response()->json(['error' => 'muted', 'muted_seconds' => $left, 'level' => (int) $me->chat_offenses], 403);
        }
        $warning = null;
        if ($body !== '') {
            [$body, $hit] = \App\Support\ChatModeration::filter($body, $me);
            if ($hit) {
                $warning = \App\Support\ChatModeration::penalize($me);
            }
        }
        if ($userId === $me->id) {
            return $this->fail('Kendine mesaj gönderemezsin.', 422);
        }
        if (! User::whereKey($userId)->exists()) {
            return $this->fail('Kullanıcı bulunamadı.', 404);
        }
        // BLOK: iki yönden biri blokladıysa mesaj gönderilemez (ben blokladım ya da o beni).
        if ($this->blockedBetween($me->id, $userId)) {
            return $this->fail('Bu kullanıcıyla mesajlaşamazsınız.', 403);
        }

        if (! $this->isOpen($me->id, $userId)) {
            $out = $this->reqRow($me->id, $userId); // benim ona istegim
            $in = $this->reqRow($userId, $me->id);  // onun bana istegi

            if ($in) {
                // Karsi taraf bana yazmisti -> cevap = istegi kabul (reddettiysem de tekrar acilir).
                DB::table('message_requests')->where('id', $in->id)
                    ->update(['status' => 'accepted', 'updated_at' => now()]);
            } else {
                if ($out && $out->status === 'declined') {
                    return $this->fail('Bu kullanıcı mesaj isteğini reddetti.', 403);
                }
                if (! $out) {
                    DB::table('message_requests')->insert([
                        'requester_id' => $me->id,
                        'target_id' => $userId,
                        'status' => 'pending',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
                // Onaylanmamis istekte flood siniri.
                $sent = Message::where('sender_id', $me->id)->where('receiver_id', $userId)->count();
                if ($sent >= self::MAX_PENDING_MSGS) {
                    return $this->fail('İstek onaylanana kadar daha fazla mesaj gönderemezsin.', 403);
                }
            }
        }

        $attrs = [
            'sender_id' => $me->id,
            'receiver_id' => $userId,
            'body' => $body,
            'read_at' => null,
            'created_at' => now(),
        ];
        if ($hasImageCol) {
            $attrs['image'] = $image;
        }
        $msg = Message::create($attrs);

        return response()->json([
            'message' => [
                'id' => $msg->id,
                'body' => $msg->body,
                'image' => $hasImageCol ? $msg->image : null,
                'mine' => true,
                'read' => false,
                'created_at' => optional($msg->created_at)->toIso8601String(),
            ],
            'warning' => $warning,
        ]);
    }

    // Gelen bir mesaj istegini KABUL et: konusma normal gelen kutusuna gecer.
    public function accept(Request $request, int $userId)
    {
        $me = $request->user()->id;
        $in = $this->reqRow($userId, $me); // karsi taraf -> ben
        if (! $in) {
            // Zaten arkadas / acik olabilir; sorun degil.
            return response()->json(['ok' => true]);
        }
        DB::table('message_requests')->where('id', $in->id)
            ->update(['status' => 'accepted', 'updated_at' => now()]);

        return response()->json(['ok' => true]);
    }

    // Gelen bir mesaj istegini REDDET: konusma gelen kutusundan kalkar, karsi taraf
    // (yeniden kabul edene kadar) sana daha fazla yazamaz.
    public function decline(Request $request, int $userId)
    {
        $me = $request->user()->id;
        $in = $this->reqRow($userId, $me);
        if ($in) {
            DB::table('message_requests')->where('id', $in->id)
                ->update(['status' => 'declined', 'updated_at' => now()]);
        } else {
            // Satir yoksa da reddi kalici kaydet (ilerideki mesajlari da engeller).
            DB::table('message_requests')->insert([
                'requester_id' => $userId,
                'target_id' => $me,
                'status' => 'declined',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['ok' => true]);
    }

    // Yonetici: bir DM mesajini kalici sil. YALNIZCA admin (is_admin).
    public function destroy(Request $request, int $userId, int $messageId)
    {
        $me = $request->user();
        if (! $me->is_admin) {
            return $this->fail('Bu islem icin yetkiniz yok.', 403);
        }
        $msg = Message::where('id', $messageId)
            ->where(function ($q) use ($me, $userId) {
                $q->where(function ($x) use ($me, $userId) {
                    $x->where('sender_id', $me->id)->where('receiver_id', $userId);
                })->orWhere(function ($x) use ($me, $userId) {
                    $x->where('sender_id', $userId)->where('receiver_id', $me->id);
                });
            })
            ->first();
        if (! $msg) {
            return $this->fail('Mesaj bulunamadı.', 404);
        }
        $msg->delete();

        return response()->json(['ok' => true, 'id' => $messageId]);
    }

    // "Sohbeti sil" (KULLANICIYA ÖZEL): bu andan eski mesajlar BANA gizlenir + sohbet listemden
    // kalkar. Karşı taraf ETKİLENMEZ (onun geçmişi durur). Karşı taraf yeni mesaj atarsa sohbet geri döner.
    public function deleteConversation(Request $request, int $userId)
    {
        $me = $request->user()->id;
        if (! Schema::hasTable('dm_clears')) {
            return response()->json(['ok' => false]); // migration kosmadi -> sessiz
        }
        // İki yöndeki en büyük mesaj ID'si: bu ID'ye kadar her şey bana gizlenir.
        $maxId = (int) (Message::query()
            ->where(function ($q) use ($me, $userId) {
                $q->where(function ($x) use ($me, $userId) {
                    $x->where('sender_id', $me)->where('receiver_id', $userId);
                })->orWhere(function ($x) use ($me, $userId) {
                    $x->where('sender_id', $userId)->where('receiver_id', $me);
                });
            })
            ->max('id') ?? 0);
        DB::table('dm_clears')->updateOrInsert(
            ['user_id' => $me, 'peer_id' => $userId],
            ['cleared_msg_id' => $maxId],
        );

        return response()->json(['ok' => true]);
    }

    // Kullanıcıyı BLOKLA: iki yönlü mesajlaşma engeli (idempotent). Gelen kutusunda sohbet kalır
    // (blok kaldırılabilsin), ama mesaj gönderilemez/alınamaz.
    public function block(Request $request, int $userId)
    {
        $me = $request->user()->id;
        if ($userId === $me) {
            return $this->fail('Kendini bloklayamazsın.', 422);
        }
        if (! User::whereKey($userId)->exists()) {
            return $this->fail('Kullanıcı bulunamadı.', 404);
        }
        if (Schema::hasTable('user_blocks')) {
            DB::table('user_blocks')->updateOrInsert(
                ['blocker_id' => $me, 'blocked_id' => $userId],
                ['created_at' => now()],
            );
        }

        return response()->json(['ok' => true, 'blocked' => true]);
    }

    // Bloğu kaldır.
    public function unblock(Request $request, int $userId)
    {
        $me = $request->user()->id;
        if (Schema::hasTable('user_blocks')) {
            DB::table('user_blocks')->where('blocker_id', $me)->where('blocked_id', $userId)->delete();
        }

        return response()->json(['ok' => true, 'blocked' => false]);
    }

    // Toplam okunmamis mesaj sayisi (rozet). ping'e de eklenir.
    public function unread(Request $request)
    {
        $me = $request->user()->id;
        $count = Message::where('receiver_id', $me)->whereNull('read_at')->count();

        return response()->json(['unread' => $count]);
    }
}
