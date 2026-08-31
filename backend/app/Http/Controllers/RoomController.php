<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoomController extends Controller
{
    // Benzersiz oda kodu (karisik olmayan karakterler)
    private function generateCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O/1/I yok
        do {
            $code = '';
            for ($i = 0; $i < 5; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (Room::where('code', $code)->exists());
        return $code;
    }

    // Oda olustur
    public function create(Request $request)
    {
        $this->cleanupStale();
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
        ]);

        $room = Room::create([
            'code' => $this->generateCode(),
            'p1_token' => $data['token'],
            'p1_user_id' => $request->user('sanctum')?->id, // avatar cerceve lookup (bahis stake=0 -> settle'i etkilemez)
            'p1_name' => $data['name'],
            'p1_rating' => $data['rating'] ?? null,
            'p1_avatar' => $data['avatar'] ?? null,
            'status' => 'waiting',
            'mode' => 'friendly', // davet kodlu ozel oda -> Dostluk maci
            'version' => 0,
        ]);

        return response()->json(['room' => $room->toClient(), 'slot' => 'p1']);
    }

    // Bayat odalari temizle (cron gerekmez, erisimde firsatci calisir):
    // - mm_waiting: 2 dk'dan eski, eslesememis
    // - biten/terkedilmis odalar: 1 gunden eski
    private function cleanupStale(): void
    {
        try {
            Room::where('status', 'mm_waiting')
                ->whereNull('p2_token')
                ->where('created_at', '<', now()->subMinutes(2))
                ->delete();
            Room::where('updated_at', '<', now()->subDay())->delete();
            \Illuminate\Support\Facades\DB::table('game_invites')
                ->where('created_at', '<', now()->subMinutes(10))
                ->delete();
        } catch (\Throwable $e) {
            // temizlik best-effort; hata olsa da akisi bozma ama sessizce yutma -> logla
            \Illuminate\Support\Facades\Log::warning('room.cleanupStale failed', ['err' => $e->getMessage()]);
        }
    }

    // Hizli eslesme: bekleyen biri varsa esle, yoksa havuza gir ve bekle.
    public function matchmaking(Request $request)
    {
        $this->cleanupStale();
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
            'stake' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            // NOT: user_id ISTEMCIDEN alinmaz (guvenlik). Sanctum token'indan gelir; asagida
            // $authUser->id kullanilir. Bu yuzden burada validate/kabul EDILMEZ (olu parametre kaldirildi).
            'min_rating' => ['nullable', 'integer', 'min:0', 'max:4000'],
            'bet_pct' => ['nullable', 'integer', 'in:0,10,30,50,100'],
            'targets' => ['nullable', 'array'],
            'targets.*' => ['integer', 'in:1,3,5,7,9,11'],
        ]);
        $stake = (int) ($data['stake'] ?? 0);
        $minRating = (int) ($data['min_rating'] ?? 0);
        $betPct = (int) ($data['bet_pct'] ?? 0);
        // GUVENLIK: user_id ISTEMCIYE guvenilerek alinmaz. Dogrulanmis Sanctum token'indan
        // gelir (route auth middleware'i disinda olsa da bearer token gonderiliyor).
        // Aksi halde saldirgan baskasinin user_id'siyle bahis odasina girip settle'da onun
        // coin'ini riske atabilir/eritebilirdi. Giris yoksa userId null (yalnizca ucretsiz oyun).
        $authUser = $request->user('sanctum');
        $userId = $authUser?->id ?? null;
        // Kabul edilen mac uzunluklari (kolay eslesme icin coklu). Bos -> tek oyun.
        $targets = array_values(array_unique(array_map('intval', $data['targets'] ?? [])));
        $targets = array_values(array_filter($targets, fn ($n) => in_array($n, [1, 3, 5, 7, 9, 11], true)));
        if (empty($targets)) {
            $targets = [1];
        }

        // Bahisli oyun (sabit stake VEYA % bahis): dogrulanmis giris + coin sart
        if ($stake > 0 || $betPct > 0) {
            if (! $authUser) {
                return $this->fail('Bahisli oyun için giriş yapmalısın.', 422);
            }
            if (($authUser->coins ?? 0) < max($stake, 1)) {
                return $this->fail('Yetersiz coin.', 422);
            }
        }

        // Zaten havuzda bekleyen kendi odam (ayni bahis/kategori) varsa onu don
        $mine = Room::where('status', 'mm_waiting')
            ->where('p1_token', $data['token'])
            ->where('stake', $stake)
            ->where('bet_pct', $betPct)
            ->first();
        if ($mine) {
            return response()->json(['room' => $mine->toClient(), 'slot' => 'p1', 'matched' => false]);
        }

        // Ayni bahis/kategorili bekleyen adaylar; min puan filtresi (tek yonlu).
        // Uzunluk KESISIMI olan ilk (en eski) rakip secilir -> coklu secim = kolay eslesme.
        // ATOMIK: aday secimi (lockForUpdate) + rakibe yazma TEK transaction icinde olmali,
        // aksi halde kilit hemen birakilir ve iki es zamanli istek ayni bekleyen odayi
        // rakip secip ikisi de p2'ye yazabilir (cift eslesme / bahis tutarsizligi).
        $opponent = DB::transaction(function () use ($data, $stake, $betPct, $minRating, $targets, $userId) {
            $q = Room::where('status', 'mm_waiting')
                ->where('stake', $stake)
                ->where('bet_pct', $betPct)
                ->where('p1_token', '!=', $data['token'])
                ->whereNull('p2_token');
            if ($minRating > 0) {
                $q->where('p1_rating', '>=', $minRating);
            }
            $candidates = $q->orderBy('created_at')->lockForUpdate()->get();

            foreach ($candidates as $cand) {
                $candTargets = is_array($cand->targets) ? $cand->targets : [1];
                $common = array_values(array_intersect($candTargets, $targets));
                if (! empty($common)) {
                    $cand->p2_token = $data['token'];
                    $cand->p2_user_id = $userId;
                    $cand->p2_name = $data['name'];
                    $cand->p2_rating = $data['rating'] ?? null;
                    $cand->p2_avatar = $data['avatar'] ?? null;
                    $cand->target = max($common); // ortak uzunluklardan en uzunu
                    $cand->status = 'playing';
                    $cand->save();
                    return $cand;
                }
            }

            return null;
        });

        if ($opponent) {
            return response()->json(['room' => $opponent->toClient(), 'slot' => 'p2', 'matched' => true]);
        }

        // Kimse yok -> havuza gir (kabul edilen uzunluklar saklanir)
        $room = Room::create([
            'code' => $this->generateCode(),
            'p1_token' => $data['token'],
            'p1_user_id' => $userId,
            'p1_name' => $data['name'],
            'p1_rating' => $data['rating'] ?? null,
            'p1_avatar' => $data['avatar'] ?? null,
            'status' => 'mm_waiting',
            'stake' => $stake,
            'bet_pct' => $betPct,
            'targets' => $targets,
            'target' => count($targets) === 1 ? $targets[0] : null,
            'mode' => 'ranked', // hizli eslesme -> Mac Oyunu
            'version' => 0,
        ]);

        return response()->json(['room' => $room->toClient(), 'slot' => 'p1', 'matched' => false]);
    }

    // Bahisli online mac sonucu: coin transferi (oda basina bir kez, atomik).
    // GUVENLIK: istemcinin 'won' beyanina KORU KORUNE guvenilmez. Online oyunda
    // sunucu hamleleri dogrulamiyor ve 'state'i iki oyuncu da yazabildigi icin
    // (bkz. update()), state TEK BASINA sahte olabilir -> forge ile coin calinamaz.
    // Bu yuzden coin YALNIZCA iki oyuncunun birbirini tutan beyaninda (biri 'won'
    // digeri 'lost') tasinir. Tek tarafli/celiskili beyanda odeme yapilmaz (pending).
    public function settle(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'won' => ['required', 'boolean'],
        ]);
        $room = Room::where('code', $code)->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        $stake = (int) $room->stake;
        $betPct = (int) $room->bet_pct;
        // Arkadaslik (davet) odasi = coin transferi YOK (yetkili; stake zaten 0 ama kesinlestir).
        if ($room->mode === 'friendly' || ($stake <= 0 && $betPct <= 0) || ! $room->p1_user_id || ! $room->p2_user_id) {
            return response()->json(['ok' => false]);
        }
        $callerIsP1 = $room->p1_token === $data['token'];
        $callerIsP2 = $room->p2_token === $data['token'];
        if (! $callerIsP1 && ! $callerIsP2) {
            return $this->fail('Bu odada değilsin.', 403);
        }
        $callerSlot = $callerIsP1 ? 'p1' : 'p2';
        $callerId = $callerIsP1 ? $room->p1_user_id : $room->p2_user_id;

        // Bu oyuncunun beyan ettigi sonucu (bir kez) kaydet
        $resultCol = $callerSlot.'_result';
        if ($room->$resultCol === null) {
            $room->$resultCol = $data['won'] ? 'won' : 'lost';
            $room->save();
        }

        // Kazanani yetkili sekilde coz; henuz belli degilse odeme yapma (rakip beyani
        // veya son mac durumu senkronu gelince tamamlanir).
        $winnerSlot = $this->resolveWinnerSlot($room->fresh());
        if ($winnerSlot === null) {
            $caller = User::find($callerId);
            return response()->json(['ok' => false, 'pending' => true, 'coins' => $caller?->coins ?? 0]);
        }

        $winnerId = $winnerSlot === 'p1' ? $room->p1_user_id : $room->p2_user_id;
        $loserId = $winnerSlot === 'p1' ? $room->p2_user_id : $room->p1_user_id;

        // Kazanan belli -> mac bitti: odayi 'finished' isaretle (Canli Maclar'da gorunmesin;
        // client status gonderemese bile guvenlik agi).
        if ($room->status !== 'finished') {
            Room::where('code', $code)->update(['status' => 'finished']);
        }

        // ATOMIK: "settled" iddiasi + coin transferi TEK transaction, kullanicilar kilitli.
        // Ayni oyuncunun es zamanli birden fazla oda cozumunde net coin uretimi/kaybi engellenir.
        $out = DB::transaction(function () use ($code, $winnerId, $loserId, $betPct, $stake) {
            // Yalnizca ilk cagri coin tasir
            $claimed = Room::where('code', $code)->where('settled', false)->update(['settled' => true]);
            if (! $claimed) {
                return ['already' => true];
            }
            // Deadlock'u onlemek icin deterministik kilit sirasi (id'ye gore)
            $ids = array_values(array_unique(array_filter([$winnerId, $loserId])));
            sort($ids);
            $locked = [];
            foreach ($ids as $uid) {
                $locked[$uid] = User::lockForUpdate()->find($uid);
            }
            $winner = $winnerId ? ($locked[$winnerId] ?? null) : null;
            $loser = $loserId ? ($locked[$loserId] ?? null) : null;

            // Transfer tutari: sabit stake, ya da % ise iki oyuncunun bahsinin min'i
            if ($betPct > 0) {
                $wBet = (int) floor((($winner->coins ?? 0) * $betPct) / 100);
                $lBet = (int) floor((($loser->coins ?? 0) * $betPct) / 100);
                $amount = max(0, min($wBet, $lBet));
            } else {
                $amount = $stake;
            }
            if ($winner) {
                $winner->coins = ($winner->coins ?? 0) + $amount;
                $winner->save();
            }
            if ($loser) {
                $loser->coins = max(0, ($loser->coins ?? 0) - $amount);
                $loser->save();
            }
            return ['amount' => $amount];
        });

        if (isset($out['already'])) {
            $caller = User::find($callerId);
            return response()->json(['ok' => false, 'coins' => $caller?->coins ?? 0]);
        }

        $caller = User::find($callerId);
        return response()->json([
            'ok' => true,
            'coins' => $caller?->coins ?? 0,
            'stake' => $out['amount'],
            'won' => $winnerId === $callerId,
        ]);
    }

    // Kazanan slot'u ('p1'|'p2') belirle, yoksa null.
    // Yalnizca KARSILIKLI MUTABAKAT guvenli: biri 'won' digeri 'lost' bildirmeli.
    // state client-yazilabilir oldugu icin hakem olarak KULLANILMAZ (forge korumasi).
    // Celiskili (ikisi de 'won') veya tek tarafli beyanda null -> odeme pending kalir.
    private function resolveWinnerSlot(Room $room): ?string
    {
        $r1 = $room->p1_result;
        $r2 = $room->p2_result;

        if ($r1 === 'won' && $r2 === 'lost') {
            return 'p1';
        }
        if ($r2 === 'won' && $r1 === 'lost') {
            return 'p2';
        }

        return null;
    }

    // Canli maclar: su an oynanan odalar (izlenebilir). Herkese acik.
    public function liveMatches()
    {
        $rooms = Room::where('status', 'playing')
            ->whereNotNull('p1_name')
            ->whereNotNull('p2_name')
            ->whereNotNull('state')
            ->where('updated_at', '>', now()->subMinutes(3)) // sadece gercekten aktif maclar
            ->orderByDesc('updated_at')
            ->limit(30)
            ->get(['code', 'p1_name', 'p1_rating', 'p1_avatar', 'p2_name', 'p2_rating', 'p2_avatar', 'stake', 'bet_pct', 'target', 'mode']);

        $list = $rooms->map(fn ($r) => [
            'code' => $r->code,
            'p1_name' => $r->p1_name,
            'p1_rating' => $r->p1_rating,
            'p1_avatar' => $r->p1_avatar,
            'p2_name' => $r->p2_name,
            'p2_rating' => $r->p2_rating,
            'p2_avatar' => $r->p2_avatar,
            'stake' => (int) $r->stake,
            'bet_pct' => (int) $r->bet_pct,
            'target' => $r->target !== null ? (int) $r->target : null,
            // Etiket icin tip: eski (null) kayitlar 'ranked' varsayilir (cogu online mac hizli eslesme)
            'mode' => $r->mode ?: 'ranked',
        ]);

        return response()->json(['matches' => $list]);
    }

    // Giris yapan kullanicinin DEVAM EDEN (playing) online maclari -> geri donebilsin.
    public function myActiveRooms(Request $request)
    {
        $me = $request->user();
        if (! $me) {
            return response()->json(['rooms' => []]);
        }
        $rooms = Room::where('status', 'playing')
            ->where(function ($q) use ($me) {
                $q->where('p1_user_id', $me->id)->orWhere('p2_user_id', $me->id);
            })
            // Yalnizca GERCEKTEN canli maclar: son 4 dk icinde guncellenmis (terk/timeout eleme)
            ->where('updated_at', '>', now()->subMinutes(4))
            ->orderByDesc('updated_at')
            ->limit(10)
            ->get(['code', 'p1_user_id', 'p1_name', 'p1_rating', 'p1_avatar', 'p2_name', 'p2_rating', 'p2_avatar', 'target', 'state']);

        $list = $rooms->map(function ($r) use ($me) {
            $mine = ((int) $r->p1_user_id === (int) $me->id) ? 'p1' : 'p2';
            $score = $r->state['match']['score'] ?? null;
            return [
                'code' => $r->code,
                'slot' => $mine,
                'opp_name' => $mine === 'p1' ? $r->p2_name : $r->p1_name,
                'opp_rating' => $mine === 'p1' ? $r->p2_rating : $r->p1_rating,
                'opp_avatar' => $mine === 'p1' ? $r->p2_avatar : $r->p1_avatar,
                'target' => $r->target,
                'score' => $score,
            ];
        })->filter(function ($m) {
            // Hedefe ulasilmis (mac bitmis) odalari listeleme -> "devam eden" degil
            $s = $m['score'];
            $t = (int) ($m['target'] ?? 0);
            if (! $s || $t <= 0) {
                return true;
            }
            $mx = max((int) ($s['white'] ?? 0), (int) ($s['black'] ?? 0));
            return $mx < $t;
        })->values();

        return response()->json(['rooms' => $list]);
    }

    // Hizli eslesmeyi iptal et (havuzdaki bekleyen odami sil)
    public function matchmakingCancel(Request $request)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:64']]);
        Room::where('status', 'mm_waiting')
            ->where('p1_token', $data['token'])
            ->whereNull('p2_token')
            ->delete();
        return $this->ok();
    }

    // Odaya katil (kod ile)
    public function join(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
        ]);

        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }

        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            // Yeni katilimci
            if ($room->p2_token) {
                return $this->fail('Oda dolu.', 409);
            }
            $room->p2_token = $data['token'];
            $room->p2_user_id = $request->user('sanctum')?->id;
            $room->p2_name = $data['name'];
            $room->p2_rating = $data['rating'] ?? null;
            $room->p2_avatar = $data['avatar'] ?? null;
            $room->status = 'playing';
            $room->save();
            $slot = 'p2';
        }

        return response()->json(['room' => $room->toClient(), 'slot' => $slot]);
    }

    // Belirli bir kodla odaya gir: yoksa olustur (p1), varsa katil (p2).
    // Turnuva maclari icin: iki oyuncu ayni kodu kullanip ayni odada bulusur.
    public function enter(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
        ]);
        $code = strtoupper($code);

        $room = Room::firstOrCreate(
            ['code' => $code],
            [
                'p1_token' => $data['token'],
                'p1_user_id' => $request->user('sanctum')?->id,
                'p1_name' => $data['name'],
                'p1_rating' => $data['rating'] ?? null,
                'p1_avatar' => $data['avatar'] ?? null,
                'status' => 'waiting',
                'version' => 0,
            ],
        );

        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            if ($room->p2_token) {
                return $this->fail('Oda dolu.', 409);
            }
            $room->p2_token = $data['token'];
            $room->p2_user_id = $request->user('sanctum')?->id;
            $room->p2_name = $data['name'];
            $room->p2_rating = $data['rating'] ?? null;
            $room->p2_avatar = $data['avatar'] ?? null;
            $room->status = 'playing';
            $room->save();
            $slot = 'p2';
        }

        return response()->json(['room' => $room->toClient(), 'slot' => $slot]);
    }

    // Oda durumunu getir (polling). ?since=version verilirse degismediyse 204.
    public function show(Request $request, string $code)
    {
        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        $since = (int) $request->query('since', -1);
        if ($since >= 0 && $room->version <= $since) {
            return response()->noContent(); // degismedi
        }
        return response()->json(['room' => $room->toClient()]);
    }

    // Oyun durumunu guncelle (hamle). Sadece odadaki oyuncular.
    public function update(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'state' => ['required', 'array'],
            'status' => ['nullable', 'string', 'in:playing,finished'],
        ]);

        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        if ($this->slotOf($room, $data['token']) === null) {
            return $this->fail('Bu odada değilsin.', 403);
        }

        $room->state = $data['state'];
        $room->version = $room->version + 1;
        if (! empty($data['status'])) {
            $room->status = $data['status'];
        }
        $room->save();

        return response()->json(['version' => $room->version, 'status' => $room->status]);
    }

    // Sohbet mesaji gonder (odadaki oyuncular). Son 50 mesaj tutulur.
    public function chat(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'text' => ['required', 'string', 'max:280'],
        ]);

        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            return $this->fail('Bu odada değilsin.', 403);
        }

        $name = $slot === 'p1' ? $room->p1_name : $room->p2_name;
        $messages = $room->messages ?? [];
        $messages[] = [
            'slot' => $slot,
            'name' => $name,
            'text' => trim($data['text']),
            'id' => (string) round(microtime(true) * 1000).'-'.$slot,
        ];
        // Son 50 mesaji tut
        if (count($messages) > 50) {
            $messages = array_slice($messages, -50);
        }
        $room->messages = $messages;
        $room->save();

        return response()->json(['messages' => $messages]);
    }

    private function slotOf(Room $room, string $token): ?string
    {
        if ($room->p1_token === $token) {
            return 'p1';
        }
        if ($room->p2_token === $token) {
            return 'p2';
        }
        return null;
    }
}
