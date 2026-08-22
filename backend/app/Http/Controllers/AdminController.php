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

        $p = $query->paginate($perPage);
        $rows = collect($p->items())->map(fn ($u) => $this->row($u));

        return response()->json([
            'users'     => $rows,
            'total'     => $p->total(),
            'page'      => $p->currentPage(),
            'last_page' => $p->lastPage(),
        ]);
    }

    // Uye guncelle: coin / yasak / yonetici bayragi
    public function updateUser(Request $request, User $user)
    {
        $me = $request->user();
        if (! $me?->is_admin) {
            return response()->json(['message' => 'Yetkisiz.'], 403);
        }

        $data = $request->validate([
            'coins'    => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'is_admin' => ['sometimes', 'boolean'],
            'banned'   => ['sometimes', 'boolean'],
        ]);

        // Kendini yasaklama / yetkiden dusurme engeli
        if ($user->id === $me->id) {
            if ((array_key_exists('banned', $data) && $data['banned'])
                || (array_key_exists('is_admin', $data) && ! $data['is_admin'])) {
                return response()->json(['message' => 'Kendini yasaklayamaz veya yetkiden düşüremezsin.'], 422);
            }
        }

        // Config e-postali admin'in yonetici bayragi DB'den kaldirilamaz (yine admin kalir)
        if (array_key_exists('is_admin', $data) && ! $data['is_admin'] && $user->isConfigAdmin()) {
            return response()->json(['message' => 'Bu hesap yapılandırmada yönetici; yetkisi kaldırılamaz.'], 422);
        }

        if (array_key_exists('coins', $data)) {
            $user->coins = $data['coins'];
        }
        if (array_key_exists('is_admin', $data)) {
            $user->is_admin = $data['is_admin'];
        }
        if (array_key_exists('banned', $data)) {
            $user->banned_at = $data['banned'] ? now() : null;
            if ($data['banned']) {
                $user->tokens()->delete(); // acik oturumlari kapat
            }
        }
        $user->save();

        return response()->json(['user' => $this->row($user->fresh())]);
    }

    private function row(User $u): array
    {
        return [
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
            'banned'     => $u->banned_at !== null,
        ];
    }
}
