<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ShopController extends Controller
{
    // Satin alinabilir kozmetikler ve coin fiyatlari (sunucu otoritesi).
    // Gorsel tanimlar (renkler vb.) frontend'de; burada yalnizca id -> fiyat.
    private const CATALOG = [
        // Premium tahta temalari
        'theme.gold' => 500,
        'theme.neon' => 800,
        'theme.ocean' => 300,
        'theme.sunset' => 600,
        // Avatar cerceveleri
        'frame.bronze' => 100,
        'frame.silver' => 250,
        'frame.gold' => 500,
        'frame.neon' => 700,
        'frame.fire' => 900,
    ];

    public function index(Request $request)
    {
        $u = $request->user();
        return response()->json([
            'catalog' => self::CATALOG,
            'unlocks' => $u->unlocks ?? [],
            'avatar_frame' => $u->avatar_frame,
            'coins' => $u->coins ?? 0,
        ]);
    }

    public function buy(Request $request)
    {
        $data = $request->validate(['id' => ['required', 'string', 'max:40']]);
        $id = $data['id'];
        if (! array_key_exists($id, self::CATALOG)) {
            return response()->json(['message' => 'Ürün bulunamadı.'], 404);
        }
        $u = $request->user();
        $unlocks = $u->unlocks ?? [];
        if (in_array($id, $unlocks, true)) {
            return response()->json(['message' => 'Zaten sahipsin.', 'unlocks' => $unlocks, 'coins' => $u->coins], 200);
        }
        $price = self::CATALOG[$id];
        if (($u->coins ?? 0) < $price) {
            return response()->json(['message' => 'Yetersiz coin.'], 422);
        }
        $u->coins = ($u->coins ?? 0) - $price;
        $unlocks[] = $id;
        $u->unlocks = $unlocks;
        $u->save();
        return response()->json(['unlocks' => $unlocks, 'coins' => $u->coins]);
    }

    // Avatar cercevesini sec (sahip olunmali; 'none' serbest)
    public function selectFrame(Request $request)
    {
        $data = $request->validate(['id' => ['nullable', 'string', 'max:40']]);
        $id = $data['id'] ?? null;
        $u = $request->user();
        if ($id && $id !== 'none') {
            $unlocks = $u->unlocks ?? [];
            if (! in_array('frame.'.$id, $unlocks, true)) {
                return response()->json(['message' => 'Bu çerçeveye sahip değilsin.'], 403);
            }
        }
        $u->avatar_frame = ($id === 'none') ? null : $id;
        $u->save();
        return response()->json(['avatar_frame' => $u->avatar_frame]);
    }
}
