<?php

namespace App\Http\Controllers;

use App\Models\Club;
use App\Models\ClubMember;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClubController extends Controller
{
    // Acik kulup listesi (uye sayisi + puana gore)
    public function index()
    {
        $list = Club::orderByDesc('points')
            ->orderByDesc('members_count')
            ->limit(100)
            ->get()
            ->map(fn ($c) => $this->summary($c));
        return response()->json(['clubs' => $list]);
    }

    // Kulup detayi + lig tablosu (uyeler puana gore)
    public function show(Club $club)
    {
        return response()->json(['club' => $this->full($club)]);
    }

    // Kulup olustur (kurucu = owner + uye). Uye baska kulupte olmamali.
    public function create(Request $request)
    {
        $me = $request->user();
        if (ClubMember::where('user_id', $me->id)->exists()) {
            return response()->json(['message' => 'Zaten bir kulüptesin. Önce ayrıl.'], 422);
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'tag' => ['nullable', 'string', 'max:6'],
            'description' => ['nullable', 'string', 'max:300'],
        ]);
        $club = DB::transaction(function () use ($data, $me) {
            $club = Club::create([
                'name' => $data['name'],
                'tag' => $data['tag'] ?? null,
                'description' => $data['description'] ?? null,
                'owner_id' => $me->id,
                'members_count' => 1,
                'points' => 0,
            ]);
            ClubMember::create([
                'club_id' => $club->id,
                'user_id' => $me->id,
                'role' => 'owner',
            ]);
            return $club;
        });
        return response()->json(['club' => $this->full($club->fresh())]);
    }

    // Kulube katil (tek kulup kurali)
    public function join(Request $request, Club $club)
    {
        $me = $request->user();
        if (ClubMember::where('user_id', $me->id)->exists()) {
            return response()->json(['message' => 'Zaten bir kulüptesin. Önce ayrıl.'], 422);
        }
        DB::transaction(function () use ($club, $me) {
            ClubMember::create([
                'club_id' => $club->id,
                'user_id' => $me->id,
                'role' => 'member',
            ]);
            $club->increment('members_count');
        });
        return response()->json(['club' => $this->full($club->fresh())]);
    }

    // Kulupten ayril. Owner ayrilirsa: baska uye varsa devret, yoksa kulup silinir.
    public function leave(Request $request)
    {
        $me = $request->user();
        $mem = ClubMember::where('user_id', $me->id)->first();
        if (! $mem) {
            return response()->json(['message' => 'Bir kulüpte değilsin.'], 422);
        }
        $club = Club::find($mem->club_id);
        DB::transaction(function () use ($mem, $club, $me) {
            $mem->delete();
            if ($club) {
                $club->decrement('members_count');
                if ($club->owner_id === $me->id) {
                    $next = ClubMember::where('club_id', $club->id)
                        ->orderBy('created_at')
                        ->first();
                    if ($next) {
                        $next->update(['role' => 'owner']);
                        $club->update(['owner_id' => $next->user_id]);
                    } else {
                        $club->delete(); // son uye ayrildi -> kulup kapanir
                    }
                }
            }
        });
        return response()->json(['ok' => true]);
    }

    // Benim kulubum (yoksa null)
    public function mine(Request $request)
    {
        $mem = ClubMember::where('user_id', $request->user()->id)->first();
        if (! $mem) {
            return response()->json(['club' => null]);
        }
        $club = Club::find($mem->club_id);
        return response()->json(['club' => $club ? $this->full($club) : null]);
    }

    // ----- Yardimcilar -----

    private function summary(Club $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'tag' => $c->tag,
            'description' => $c->description,
            'members_count' => $c->members_count,
            'points' => $c->points,
        ];
    }

    private function full(Club $c): array
    {
        $rows = ClubMember::where('club_id', $c->id)
            ->orderByDesc('points')
            ->orderByDesc('wins')
            ->limit(200)
            ->get();
        $users = User::whereIn('id', $rows->pluck('user_id'))
            ->get()
            ->keyBy('id');
        $table = $rows->map(function ($m) use ($users) {
            $u = $users->get($m->user_id);
            return [
                'user_id' => $m->user_id,
                'nickname' => $u?->nickname ?? '—',
                'avatar' => $u?->avatar,
                'rating' => $u?->rating ?? 1500,
                'role' => $m->role,
                'points' => $m->points,
                'wins' => $m->wins,
                'losses' => $m->losses,
            ];
        })->values();
        return array_merge($this->summary($c), [
            'owner_id' => $c->owner_id,
            'table' => $table,
        ]);
    }
}
