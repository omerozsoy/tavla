<?php

namespace App\Http\Controllers;

use App\Models\Room;
use Illuminate\Http\Request;

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

    // Hizli eslesme: bekleyen biri varsa esle, yoksa havuza gir ve bekle.
    public function matchmaking(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
        ]);

        // Zaten havuzda bekleyen kendi odam varsa onu don (cift istek korumasi)
        $mine = Room::where('status', 'mm_waiting')->where('p1_token', $data['token'])->first();
        if ($mine) {
            return response()->json(['room' => $mine->toClient(), 'slot' => 'p1', 'matched' => false]);
        }

        // Bekleyen baska bir oyuncu bul (en eski). Kilit yaris kosulunu azaltir.
        $opponent = Room::where('status', 'mm_waiting')
            ->where('p1_token', '!=', $data['token'])
            ->whereNull('p2_token')
            ->orderBy('created_at')
            ->lockForUpdate()
            ->first();

        if ($opponent) {
            $opponent->p2_token = $data['token'];
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
            'p1_name' => $data['name'],
            'p1_rating' => $data['rating'] ?? null,
            'p1_avatar' => $data['avatar'] ?? null,
            'status' => 'mm_waiting',
            'version' => 0,
        ]);

        return response()->json(['room' => $room->toClient(), 'slot' => 'p1', 'matched' => false]);
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
