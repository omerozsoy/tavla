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
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'size' => ['required', 'integer', 'in:4,8,16'],
        ]);
        $t = Tournament::create([
            'name' => $data['name'],
            'size' => $data['size'],
            'status' => 'open',
            'creator_id' => $request->user()->id,
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
        if (count($players) >= $tournament->size) {
            return response()->json(['message' => 'Turnuva dolu.'], 422);
        }
        $this->addPlayer($tournament, $request->user());
        $t = $tournament->fresh();
        // Dolduysa otomatik basla
        if (count($t->players) >= $t->size) {
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
        }

        $tournament->bracket = $bracket;
        $tournament->save();
        return response()->json(['tournament' => $this->full($tournament->fresh())]);
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
        $size = $t->size;
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
