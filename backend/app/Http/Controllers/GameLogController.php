<?php

namespace App\Http\Controllers;

use App\Models\GameLog;
use App\Models\Room;
use App\Support\RoomAccess;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * OYNANAN TÜM maçların hamle+zar kaydını alır (denetim/replay). Oyun tarayıcıda çalıştığı
 * için kayıt istemciden gelir: her istemci KENDİ turlarını kendi slot kolonuna yazar
 * (p1_events/p2_events, her kolon tek yazar). Meta (isim/mod/uzunluk) ilk çağrıda set edilir;
 * online maçta oda bilgisiyle zenginleştirilir. Online slot ve sonuç server/oda yetkisiyle
 * belirlenir; pvb/local kayıtlar misafir uyumluluğu için istemci sonuçlarını kabul edebilir.
 *
 * Açık uç: throttle + boyut sınırlarıyla korunur (bkz. routes/api.php). Kimlik doğrulama
 * gerekmez (misafir pvb oynayabilir). Online kayıt için oda koltuğu hesap veya guest token ile
 * doğrulanır; client'ın gönderdiği slot/winner/score/status ekonomik sonuç sayılmaz.
 */
class GameLogController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'uid' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'slot' => ['required', Rule::in(['p1', 'p2'])],
            'mode' => ['required', Rule::in(['pvb', 'online', 'local'])],
            'token' => ['nullable', 'string', 'max:128'],
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

        // Online kayıtlar yalnızca ilgili odanın yetkili oyuncusundan kabul edilir.
        // Slot ve sonuç metadatası client'tan gelmez; oda/server state'inden türetilir.
        if ($data['mode'] === 'online') {
            $room = Room::where('code', $uid)->first();
            if (! $room) {
                return response()->json(['message' => 'Oda bulunamadı'], 404);
            }
            $actor = $request->user('sanctum');
            $guestToken = (string) ($data['token'] ?? $request->header('X-Room-Token', ''));
            $authorizedSlot = RoomAccess::slot($room, $actor, $guestToken);
            if ($authorizedSlot === null) {
                return response()->json(['message' => 'Bu maç kaydına yazma yetkiniz yok'], 403);
            }
            $data['slot'] = $authorizedSlot;
            $meta['p1_name'] = $room->p1_name ?: null;
            $meta['p2_name'] = $room->p2_name ?: null;
            $meta['p1_user_id'] = $room->p1_user_id;
            $meta['p2_user_id'] = $room->p2_user_id;
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

        // Online sonuç client payload'ından okunmaz. Yalnız doğrulanmış server_match
        // tamamlandıysa replay metadata'sına yansıtılır; pvb/local kayıtları geriye dönük
        // olarak kendi yerel sonuçlarını yazmaya devam edebilir.
        if ($data['mode'] === 'online') {
            $match = $room->server_match;
            if ($room->hasVerifiedServerResult()) {
                $log->status = 'finished';
                $log->winner = $match['winner'];
                if (is_array($match['score'] ?? null)) {
                    $log->score = $match['score'];
                }
            }
        } else {
            if (($data['status'] ?? null) === 'finished') {
                $log->status = 'finished';
            }
            if (! empty($data['winner'])) {
                $log->winner = $data['winner'];
            }
            if (! empty($data['score'])) {
                $log->score = $data['score'];
            }
        }

        $log->save();

        return response()->json(['ok' => true]);
    }

    /**
     * KANONİK XG .mat: bu maçın (uid) TEK OTORİTER kaynaktan (merged game_logs -> MatFromLog)
     * üretilmiş .mat metni. Client "Dışa Aktar" bunu indirir -> AYNI maç DAİMA AYNI .mat
     * (deterministik: stabil matchId=uid + created_at, iki oyuncunun küpü birleşik, kanonik zar).
     * Kayıt yoksa (henüz flush edilmemiş) 404 -> client yerel buildMatXg'e düşer.
     */
    public function mat(string $uid)
    {
        $log = GameLog::where('uid', $uid)->first();
        if (! $log) {
            return response()->json(['message' => 'Kayıt bulunamadı'], 404);
        }

        // YARIM KAYIT KORUMASI: online maçta bir oyuncunun istemcisi kendi turlarını hiç
        // yükleyemediyse (tek-yazar kolon boş kaldı) birleşik .mat'te o rengin sütunu BOMBOŞ
        // olur -> XG geçersiz sayar. Böyle yarım kaydı KANONİK diye sunmak yerine 404 ver;
        // istemci maçın tamamını gördüğü YEREL yedeğe düşsün (iki oyuncu da TAM .mat alır).
        if ($log->mode === 'online') {
            $w = 0;
            $b = 0;
            foreach ($log->mergedTurns() as $t) {
                if (($t['k'] ?? null) === 'end') {
                    continue; // sonuç satırı tek renkli sayılmaz
                }
                if (($t['p'] ?? '') === 'W') {
                    $w++;
                } elseif (($t['p'] ?? '') === 'B') {
                    $b++;
                }
            }
            if (($w === 0) !== ($b === 0)) { // tam biri 0, diğeri > 0 -> yarım kayıt
                return response()->json(['message' => 'Kayıt eksik'], 404);
            }
        }

        // matText, sonuçsuz bir ARA oyun bulursa (previousGame.result=null) BOZUK .mat sunmak yerine
        // RuntimeException fırlatır (bkz. MatSerializer). Kanonik kaynak bunu üretemiyorsa 422 ver;
        // istemci yerel yedeğe düşer (o da imkânsız değer yazmaz -> kullanıcı sessiz bozuk dosya almaz).
        try {
            $mat = $log->matText();
        } catch (\RuntimeException $e) {
            return response()->json(['message' => 'Kayıt tutarsız: '.$e->getMessage()], 422);
        }

        return response()->json([
            'mat' => $mat,
            'filename' => $log->matFilename(),
        ]);
    }
}
