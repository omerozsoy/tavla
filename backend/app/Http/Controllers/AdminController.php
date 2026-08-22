<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    // Uye listesi (yalnizca yonetici): arama + sayfalama
    public function users(Request $request)
    {
        if (! $request->user()?->is_admin) {
            return response()->json(['message' => 'Yetkisiz.'], 403);
        }

        $q = trim((string) $request->query('q', ''));
        $perPage = min(50, max(5, (int) $request->query('per_page', 25)));

        $query = User::query()->orderByDesc('created_at');
        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('nickname', 'like', "%{$q}%")
                    ->orWhere('first_name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%");
            });
        }

        $p = $query->paginate($perPage, [
            'id', 'first_name', 'nickname', 'email', 'country',
            'rating', 'coins', 'wins', 'losses', 'games_played',
            'last_seen', 'created_at',
        ]);

        $rows = collect($p->items())->map(fn ($u) => [
            'id'         => $u->id,
            'name'       => $u->nickname ?: $u->first_name ?: 'Oyuncu',
            'email'      => $u->email,
            'country'    => $u->country,
            'rating'     => $u->rating ?? 1500,
            'coins'      => $u->coins ?? 0,
            'wins'       => $u->wins ?? 0,
            'losses'     => $u->losses ?? 0,
            'games'      => $u->games_played ?? 0,
            'last_seen'  => $u->last_seen,
            'created_at' => $u->created_at,
            'is_admin'   => $u->is_admin,
        ]);

        return response()->json([
            'users'     => $rows,
            'total'     => $p->total(),
            'page'      => $p->currentPage(),
            'last_page' => $p->lastPage(),
        ]);
    }
}
