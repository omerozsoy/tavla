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
            'p1_name' => $data['name'],
            'p1_rating' => $data['rating'] ?? null,
            'p1_avatar' => $data['avatar'] ?? null,
            'status' => 'waiting',
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
            // temizlik best-effort; hata olsa da akisi bozma
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
            'user_id' => ['nullable', 'integer'],
            'min_rating' => ['nullable', 'integer', 'min:0', 'max:4000'],
            'bet_pct' => ['nullable', 'integer', 'in:0,10,30,50,100'],
        ]);
        $stake = (int) ($data['stake'] ?? 0);
        $userId = $data['user_id'] ?? null;
        $minRating = (int) ($data['min_rating'] ?? 0);
        $betPct = (int) ($data['bet_pct'] ?? 0);

        // Bahisli oyun (sabit stake VEYA % bahis): giris + coin sart
        if ($stake > 0 || $betPct > 0) {
            if (! $userId) {
                return response()->json(['message' => 'Bahisli oyun için giriş yapmalısın.'], 422);
            }
            $u = User::find($userId);
            if (! $u || ($u->coins ?? 0) < max($stake, 1)) {
                return response()->json(['message' => 'Yetersiz coin.'], 422);
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

        // Ayni bahis/kategorili bekleyen rakip bul; min puan filtresi (tek yonlu)
        $q = Room::where('status', 'mm_waiting')
            ->where('stake', $stake)
            ->where('bet_pct', $betPct)
            ->where('p1_token', '!=', $data['token'])
            ->whereNull('p2_token');
        if ($minRating > 0) {
            $q->where('p1_rating', '>=', $minRating);
        }
        $opponent = $q->orderBy('created_at')->lockForUpdate()->first();

        if ($opponent) {
            $opponent->p2_token = $data['token'];
            $opponent->p2_user_id = $userId;
            $opponent->p2_name = $data['name'];
            $opponent->p2_rating = $data['rating'] ?? null;
            $opponent->p2_avatar = $data['avatar'] ?? null;
            $opponent->status = 'playing';
            $opponent->save();
            return response()->json(['room' => $opponent->toClient(), 'slot' => 'p2', 'matched' => true]);
        }

        // Kimse yok -> havuza gir
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
            'version' => 0,
        ]);

        return response()->json(['room' => $room->toClient(), 'slot' => 'p1', 'matched' => false]);
    }

    // Bahisli online mac sonucu: coin transferi (oda basina bir kez, atomik).
    // GUVENLIK: istemcinin 'won' beyanina KORU KORUNE guvenilmez. Kazanan;
    //   (1) sunucudaki senkron mac durumundan (yetkili), ya da
    //   (2) iki oyuncunun birbirini tutan beyanindan belirlenir.
    // Tek tarafli/celiskili beyanla, durum da dogrulamıyorsa coin tasinmaz.
    public function settle(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'won' => ['required', 'boolean'],
        ]);
        $room = Room::where('code', $code)->first();
        if (! $room) {
            return response()->json(['message' => 'Oda bulunamadı.'], 404);
        }
        $stake = (int) $room->stake;
        $betPct = (int) $room->bet_pct;
        if (($stake <= 0 && $betPct <= 0) || ! $room->p1_user_id || ! $room->p2_user_id) {
            return response()->json(['ok' => false]);
        }
        $callerIsP1 = $room->p1_token === $data['token'];
        $callerIsP2 = $room->p2_token === $data['token'];
        if (! $callerIsP1 && ! $callerIsP2) {
            return response()->json(['message' => 'Bu odada değilsin.'], 403);
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

    // Kazanan slot'u ('p1'|'p2') yetkili sekilde belirle, yoksa null.
    // Oncelik: iki tarafli mutabakat > celiskide yetkili durum > tek taraf + durum dogrulamasi.
    private function resolveWinnerSlot(Room $room): ?string
    {
        $r1 = $room->p1_result;
        $r2 = $room->p2_result;
        $stateWinner = $this->winnerFromState($room); // 'p1'|'p2'|null

        // Mutabakat: biri 'won' digeri 'lost' -> net kazanan
        if ($r1 === 'won' && $r2 === 'lost') {
            return 'p1';
        }
        if ($r2 === 'won' && $r1 === 'lost') {
            return 'p2';
        }
        // Ikisi de bildirdi ama celiskili (ikisi de 'won' vb.) -> yetkili mac durumu hakem
        if ($r1 !== null && $r2 !== null) {
            return $stateWinner;
        }
        // Tek taraf bildirdi -> yalnizca yetkili durum bu beyani DOGRULARSA ode
        $reporter = $r1 !== null ? 'p1' : ($r2 !== null ? 'p2' : null);
        if ($reporter === null || $stateWinner === null) {
            return null;
        }
        $claimWinner = $room->{$reporter.'_result'} === 'won'
            ? $reporter
            : ($reporter === 'p1' ? 'p2' : 'p1');

        return $stateWinner === $claimWinner ? $stateWinner : null;
    }

    // Senkronlanan mac durumundan kazanan slot (p1=beyaz, p2=siyah). Karar yoksa null.
    private function winnerFromState(Room $room): ?string
    {
        $state = $room->state;
        $match = is_array($state) ? ($state['match'] ?? null) : null;
        if (! is_array($match) || ! isset($match['target'], $match['score'])) {
            return null;
        }
        $target = (int) $match['target'];
        $w = (int) ($match['score']['white'] ?? 0);
        $b = (int) ($match['score']['black'] ?? 0);
        if ($target <= 0) {
            return null;
        }
        if ($w >= $target && $w > $b) {
            return 'p1';
        }
        if ($b >= $target && $b > $w) {
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
            ->get(['code', 'p1_name', 'p1_rating', 'p1_avatar', 'p2_name', 'p2_rating', 'p2_avatar', 'stake', 'bet_pct']);

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
        ]);

        return response()->json(['matches' => $list]);
    }

    // Hizli eslesmeyi iptal et (havuzdaki bekleyen odami sil)
    public function matchmakingCancel(Request $request)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:64']]);
        Room::where('status', 'mm_waiting')
            ->where('p1_token', $data['token'])
            ->whereNull('p2_token')
            ->delete();
        return response()->json(['ok' => true]);
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
            return response()->json(['message' => 'Oda bulunamadı.'], 404);
        }

        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            // Yeni katilimci
            if ($room->p2_token) {
                return response()->json(['message' => 'Oda dolu.'], 409);
            }
            $room->p2_token = $data['token'];
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
                return response()->json(['message' => 'Oda dolu.'], 409);
            }
            $room->p2_token = $data['token'];
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
            return response()->json(['message' => 'Oda bulunamadı.'], 404);
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
            return response()->json(['message' => 'Oda bulunamadı.'], 404);
        }
        if ($this->slotOf($room, $data['token']) === null) {
            return response()->json(['message' => 'Bu odada değilsin.'], 403);
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
            return response()->json(['message' => 'Oda bulunamadı.'], 404);
        }
        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            return response()->json(['message' => 'Bu odada değilsin.'], 403);
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
