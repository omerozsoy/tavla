<?php

namespace App\Http\Controllers;

use App\Models\Tournament;
use Illuminate\Http\Request;

class TournamentController extends Controller
{
    // Acik + devam eden turnuvalar
    public function index()
    {
        $list = Tournament::whereIn('status', ['open', 'running'])
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn ($t) => $this->summary($t));
        return response()->json(['tournaments' => $list]);
    }

    public function show(Tournament $tournament)
    {
        return response()->json(['tournament' => $this->full($tournament)]);
    }

    public function create(Request $request)
    {
        // Yalnizca yonetici turnuva olusturabilir
        if (! $request->user()->is_admin) {
            return response()->json(['message' => 'Yalnızca yönetici turnuva oluşturabilir.'], 403);
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'size' => ['required', 'integer', 'in:0,4,8,16,32,64,128,256'], // 0 = sinirsiz
            'prize_coins' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'prize_desc' => ['nullable', 'string', 'max:120'],
            'entry_fee' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ]);
        $t = Tournament::create([
            'name' => $data['name'],
            'size' => $data['size'],
            'status' => 'open',
            'creator_id' => $request->user()->id,
            'prize_coins' => $data['prize_coins'] ?? 0,
            'prize_desc' => $data['prize_desc'] ?? null,
            'entry_fee' => $data['entry_fee'] ?? 0,
            'players' => [],
        ]);
        // Olusturan otomatik katilir
        $this->addPlayer($t, $request->user());
        return response()->json(['tournament' => $this->full($t->fresh())]);
    }

    public function join(Request $request, Tournament $tournament)
    {
        if ($tournament->status !== 'open') {
            return response()->json(['message' => 'Turnuva kayıtları kapalı.'], 422);
        }
        $players = $tournament->players ?? [];
        // size 0 = sinirsiz (kapasite yok); aksi halde dolulukta kayit kapali
        if ($tournament->size > 0 && count($players) >= $tournament->size) {
            return response()->json(['message' => 'Turnuva dolu.'], 422);
        }
        $me = $request->user();
        // Zaten kayitli mi?
        $already = false;
        foreach ($players as $p) {
            if (($p['id'] ?? null) === $me->id) {
                $already = true;
                break;
            }
        }
        // Giris ucreti (kayitli degilse) -> coin dus, odul havuzuna ekle
        $fee = $tournament->entry_fee ?? 0;
        if (! $already && $fee > 0) {
            if (($me->coins ?? 0) < $fee) {
                return response()->json(['message' => 'Giriş ücreti için yetersiz coin.'], 422);
            }
            $me->coins = ($me->coins ?? 0) - $fee;
            $me->save();
            $tournament->prize_coins = ($tournament->prize_coins ?? 0) + $fee;
            $tournament->save();
        }
        $this->addPlayer($tournament, $me);
        $t = $tournament->fresh();
        // Sabit boyut dolduysa otomatik basla (sinirsizda admin elle baslatir)
        if ($t->size > 0 && count($t->players) >= $t->size) {
            $this->startBracket($t);
            $t = $t->fresh();
        }
        return response()->json(['tournament' => $this->full($t)]);
    }

    // Bir macin sonucunu bildir (kazanan = winner_id). Sadece macin oyuncularindan biri.
    public function report(Request $request, Tournament $tournament)
    {
        $data = $request->validate([
            'match' => ['required', 'string', 'max:16'],
            'winner_id' => ['required', 'integer'],
        ]);
        if ($tournament->status !== 'running') {
            return response()->json(['message' => 'Turnuva aktif değil.'], 422);
        }
        $me = $request->user()->id;
        $bracket = $tournament->bracket;
        $found = null;
        foreach ($bracket as $ri => $round) {
            foreach ($round as $mi => $m) {
                if ($m['key'] === $data['match']) {
                    $found = [$ri, $mi, $m];
                    break 2;
                }
            }
        }
        if (! $found) {
            return response()->json(['message' => 'Maç bulunamadı.'], 404);
        }
        [$ri, $mi, $m] = $found;
        $ids = [$m['p1']['id'] ?? null, $m['p2']['id'] ?? null];
        if (! in_array($me, $ids, true)) {
            return response()->json(['message' => 'Bu maçta değilsin.'], 403);
        }
        if (! in_array($data['winner_id'], $ids, true)) {
            return response()->json(['message' => 'Geçersiz kazanan.'], 422);
        }
        if (! empty($m['winner'])) {
            return response()->json(['message' => 'Sonuç zaten girildi.'], 422);
        }

        $bracket[$ri][$mi]['winner'] = $data['winner_id'];
        $winner = $bracket[$ri][$mi][$m['p1']['id'] === $data['winner_id'] ? 'p1' : 'p2'];

        // Kazanani bir sonraki tura tasi
        if (isset($bracket[$ri + 1])) {
            $nextIndex = intdiv($mi, 2);
            $slot = $mi % 2 === 0 ? 'p1' : 'p2';
            $bracket[$ri + 1][$nextIndex][$slot] = $winner;
        } else {
            // Final bitti -> sampiyon
            $tournament->champion_id = $data['winner_id'];
            $tournament->status = 'finished';
            // Odul coin'i sampiyona ode (bir kez)
            if (! $tournament->prize_paid && $tournament->prize_coins > 0) {
                $champ = \App\Models\User::find($data['winner_id']);
                if ($champ) {
                    $champ->coins = ($champ->coins ?? 0) + $tournament->prize_coins;
                    $champ->save();
                    $tournament->prize_paid = true;
                }
            }
        }

        $tournament->bracket = $bracket;
        $tournament->save();
        return response()->json(['tournament' => $this->full($tournament->fresh())]);
    }

    // Bir turnuva maci icin paylasimli oda kodu (bir kez uretilir, bracket'e saklanir)
    public function matchRoom(Request $request, Tournament $tournament)
    {
        $data = $request->validate(['match' => ['required', 'string', 'max:16']]);
        if ($tournament->status !== 'running') {
            return response()->json(['message' => 'Turnuva aktif değil.'], 422);
        }
        $me = $request->user()->id;
        $bracket = $tournament->bracket;
        foreach ($bracket as $ri => $round) {
            foreach ($round as $mi => $m) {
                if ($m['key'] !== $data['match']) {
                    continue;
                }
                $ids = [$m['p1']['id'] ?? null, $m['p2']['id'] ?? null];
                if (! in_array($me, $ids, true)) {
                    return response()->json(['message' => 'Bu maçta değilsin.'], 403);
                }
                if (! empty($m['winner'])) {
                    return response()->json(['message' => 'Maç bitti.'], 422);
                }
                if (empty($m['room'])) {
                    // Benzersiz kod uret
                    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    do {
                        $code = '';
                        for ($i = 0; $i < 5; $i++) {
                            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
                        }
                    } while (\App\Models\Room::where('code', $code)->exists());
                    $bracket[$ri][$mi]['room'] = $code;
                    $tournament->bracket = $bracket;
                    $tournament->save();
                }
                return response()->json(['code' => $bracket[$ri][$mi]['room']]);
            }
        }
        return response()->json(['message' => 'Maç bulunamadı.'], 404);
    }

    // Turnuvayi bitir (yalnizca yonetici)
    public function finish(Request $request, Tournament $tournament)
    {
        if (! $request->user()?->is_admin) {
            return response()->json(['message' => 'Yalnızca yönetici.'], 403);
        }
        $tournament->status = 'finished';
        $tournament->save();
        return response()->json(['tournament' => $this->full($tournament)]);
    }

    // Turnuvayi elle baslat (sinirsiz turnuvalar icin; yalnizca yonetici)
    public function start(Request $request, Tournament $tournament)
    {
        if (! $request->user()?->is_admin) {
            return response()->json(['message' => 'Yalnızca yönetici.'], 403);
        }
        if ($tournament->status !== 'open') {
            return response()->json(['message' => 'Turnuva zaten başladı.'], 422);
        }
        if (count($tournament->players ?? []) < 2) {
            return response()->json(['message' => 'En az 2 oyuncu gerekli.'], 422);
        }
        $this->startBracket($tournament);
        return response()->json(['tournament' => $this->full($tournament->fresh())]);
    }

    // Turnuvayi sil (yalnizca yonetici)
    public function destroy(Request $request, Tournament $tournament)
    {
        if (! $request->user()?->is_admin) {
            return response()->json(['message' => 'Yalnızca yönetici.'], 403);
        }
        $tournament->delete();
        return response()->json(['ok' => true]);
    }

    /* ---------- yardimcilar ---------- */

    private function addPlayer(Tournament $t, $user): void
    {
        $players = $t->players ?? [];
        foreach ($players as $p) {
            if (($p['id'] ?? null) === $user->id) {
                return; // zaten kayitli
            }
        }
        $players[] = [
            'id' => $user->id,
            'name' => $user->nickname ?: $user->first_name ?: 'Oyuncu',
            'rating' => $user->rating ?? 1500,
            'avatar' => $user->avatar,
        ];
        $t->players = $players;
        $t->save();
    }

    // Rating'e gore seed'leyip 1. tur eslesmelerini uret (bye'lar otomatik ilerler)
    private function startBracket(Tournament $t): void
    {
        $players = $t->players ?? [];
        usort($players, fn ($a, $b) => ($b['rating'] ?? 0) <=> ($a['rating'] ?? 0));
        $size = (int) $t->size;
        // Sinirsiz (0): oyuncu sayisina gore bir sonraki 2'nin kuvvetine yuvarla
        if ($size < 4) {
            $n = max(2, count($players));
            $size = 1;
            while ($size < $n) {
                $size *= 2;
            }
        }
        while (count($players) < $size) {
            $players[] = null; // bye
        }
        // Standart seed sirasi (1 vs son, 2 vs sondan bir onceki ...)
        $round0 = [];
        for ($i = 0; $i < $size / 2; $i++) {
            $p1 = $players[$i];
            $p2 = $players[$size - 1 - $i];
            $m = ['key' => "r0m$i", 'p1' => $p1, 'p2' => $p2, 'winner' => null];
            // Bye: rakip yoksa otomatik kazanir
            if ($p1 && ! $p2) {
                $m['winner'] = $p1['id'];
            } elseif ($p2 && ! $p1) {
                $m['winner'] = $p2['id'];
            }
            $round0[] = $m;
        }
        // Bos turlari olustur
        $bracket = [$round0];
        $count = $size / 2;
        $r = 1;
        while ($count > 1) {
            $count = intdiv($count, 2);
            $round = [];
            for ($i = 0; $i < $count; $i++) {
                $round[] = ['key' => "r{$r}m$i", 'p1' => null, 'p2' => null, 'winner' => null];
            }
            $bracket[] = $round;
            $r++;
        }
        // Round0 bye kazananlarini round1'e tasi
        foreach ($round0 as $mi => $m) {
            if (! empty($m['winner']) && isset($bracket[1])) {
                $w = $m['p1'] && $m['p1']['id'] === $m['winner'] ? $m['p1'] : $m['p2'];
                $slot = $mi % 2 === 0 ? 'p1' : 'p2';
                $bracket[1][intdiv($mi, 2)][$slot] = $w;
            }
        }
        $t->bracket = $bracket;
        $t->status = 'running';
        $t->players = $players;
        $t->save();
    }

    private function summary(Tournament $t): array
    {
        return [
            'id' => $t->id,
            'name' => $t->name,
            'size' => $t->size,
            'status' => $t->status,
            'count' => count(array_filter($t->players ?? [], fn ($p) => $p !== null)),
            'prize_coins' => $t->prize_coins ?? 0,
            'prize_desc' => $t->prize_desc,
            'entry_fee' => $t->entry_fee ?? 0,
        ];
    }

    private function full(Tournament $t): array
    {
        return array_merge($this->summary($t), [
            'players' => array_values(array_filter($t->players ?? [], fn ($p) => $p !== null)),
            'bracket' => $t->bracket,
            'champion_id' => $t->champion_id,
        ]);
    }
}
