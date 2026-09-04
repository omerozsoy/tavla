<?php

namespace App\Http\Controllers;

use App\Models\GameLog;
use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * OYNANAN TÜM maçların hamle+zar kaydını alır (denetim/replay). Oyun tarayıcıda çalıştığı
 * için kayıt istemciden gelir: her istemci KENDİ turlarını kendi slot kolonuna yazar
 * (p1_events/p2_events, her kolon tek yazar). Meta (isim/mod/uzunluk) ilk çağrıda set edilir;
 * online maçta oda bilgisiyle zenginleştirilir. winner/score/status yalnız verilirse güncellenir.
 *
 * Açık uç: throttle + boyut sınırlarıyla korunur (bkz. routes/api.php). Kimlik doğrulama
 * gerekmez (misafir pvb oynayabilir); user_id varsa oda/oturumdan iliştirilir.
 */
class GameLogController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'uid' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'slot' => ['required', Rule::in(['p1', 'p2'])],
            'mode' => ['required', Rule::in(['pvb', 'online', 'local'])],
            'target' => ['required', 'integer', 'min:1', 'max:25'],
            'p1_name' => ['nullable', 'string', 'max:40'],
            'p2_name' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', Rule::in(['playing', 'finished'])],
            'winner' => ['nullable', Rule::in(['white', 'black'])],
            'score' => ['nullable', 'array'],
            'score.white' => ['nullable', 'integer', 'min:0', 'max:255'],
            'score.black' => ['nullable', 'integer', 'min:0', 'max:255'],
            'events' => ['present', 'array', 'max:4000'],
            'events.*.g' => ['required', 'integer', 'min:1', 'max:255'],
            'events.*.s' => ['required', 'integer', 'min:0', 'max:65535'],
            'events.*.p' => ['required', Rule::in(['W', 'B'])],
            'events.*.d' => ['nullable', 'string', 'max:16'],
            'events.*.m' => ['nullable', 'string', 'max:64'],
            'events.*.o' => ['nullable', 'integer', 'min:-16', 'max:16'], // aynı seq'te ikincil sıra
            'events.*.k' => ['nullable', Rule::in(['cube', 'end'])],       // kup / oyun sonu
        ]);

        $uid = $data['uid'];

        // Meta yalnız ilk oluşturmada yazılır (idempotent). Yarışta unique kısıtı korur.
        $meta = [
            'mode' => $data['mode'],
            'target' => $data['target'],
            'p1_name' => $data['p1_name'] ?? null,
            'p2_name' => $data['p2_name'] ?? null,
        ];

        // Online maç: odadan güvenilir isim + user_id iliştir (varsa).
        if ($data['mode'] === 'online') {
            $room = Room::where('code', $uid)->first();
            if ($room) {
                $meta['p1_name'] = $room->p1_name ?: $meta['p1_name'];
                $meta['p2_name'] = $room->p2_name ?: $meta['p2_name'];
                $meta['p1_user_id'] = $room->p1_user_id;
                $meta['p2_user_id'] = $room->p2_user_id;
            }
        }

        try {
            $log = GameLog::firstOrCreate(['uid' => $uid], $meta);
        } catch (\Illuminate\Database\QueryException $e) {
            // Eşzamanlı oluşturma yarışı: kayıt oluştu, tekrar oku.
            $log = GameLog::where('uid', $uid)->firstOrFail();
        }

        // Yalnız bu istemcinin slot kolonunu yaz (tek yazar -> güvenli üzerine yazma).
        $col = $data['slot'] === 'p1' ? 'p1_events' : 'p2_events';
        $log->{$col} = $data['events'];

        // winner/score/status YALNIZ verilirse (maç sonu) güncellenir; null ile ezme.
        if (($data['status'] ?? null) === 'finished') {
            $log->status = 'finished';
        }
        if (! empty($data['winner'])) {
            $log->winner = $data['winner'];
        }
        if (! empty($data['score'])) {
            $log->score = $data['score'];
        }

        $log->save();

        return response()->json(['ok' => true]);
    }
}
