<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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
        // Avatar cerceveleri (yeni sade Safir seti; eski tum frame.* kaldirildi).
        // Fiyatlar frontend avatarFrames.ts FRAME_RARITY_PRICE ile birebir (rare 500 / epic 1000 / legendary 2000).
        'frame.sapphire-pulse' => 500,
        'frame.sapphire-heartbeat' => 500,
        'frame.sapphire-glow' => 1000,
        'frame.sapphire-pendulum' => 1000,
        'frame.sapphire-neon' => 2000,
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
            return $this->fail('Ürün bulunamadı.', 404);
        }
        $price = self::CATALOG[$id];

        // ATOMIK: satir kilidi ile oku-kontrol-yaz (cift satin alma / eksi bakiye yaris korumasi)
        $r = DB::transaction(function () use ($request, $id, $price) {
            $u = User::lockForUpdate()->find($request->user()->id);
            $unlocks = $u->unlocks ?? [];
            if (in_array($id, $unlocks, true)) {
                return ['owned' => true, 'unlocks' => $unlocks, 'coins' => $u->coins ?? 0];
            }
            if (($u->coins ?? 0) < $price) {
                return ['insufficient' => true, 'coins' => $u->coins ?? 0];
            }
            $u->coins = ($u->coins ?? 0) - $price;
            $unlocks[] = $id;
            $u->unlocks = $unlocks;
            $u->save();
            return ['unlocks' => $unlocks, 'coins' => $u->coins];
        });

        if (isset($r['insufficient'])) {
            return $this->fail('Yetersiz coin.', 422, ['coins' => $r['coins']]);
        }
        if (isset($r['owned'])) {
            // Yumusak sonuc: zaten sahip (HATA degil) -> 200 + mesaj + guncel durum.
            return response()->json(['message' => 'Zaten sahipsin.', 'unlocks' => $r['unlocks'], 'coins' => $r['coins']]);
        }
        return response()->json(['unlocks' => $r['unlocks'], 'coins' => $r['coins']]);
    }

    private const REWARD_AMOUNT = 500;
    private const REWARD_COOLDOWN = 6 * 3600; // 6 saat (saniye)

    // 6 saatte bir 500 coin odulu
    public function daily(Request $request)
    {
        // ATOMIK: satir kilidi ile cooldown kontrolu (cift odul talebi yaris korumasi)
        $r = DB::transaction(function () use ($request) {
            $u = User::lockForUpdate()->find($request->user()->id);
            $last = $u->last_reward ? Carbon::parse($u->last_reward) : null;
            // abs(): Carbon 3 diffInSeconds isaretli doner -> mutlak gecen sure
            $elapsed = $last ? (int) abs(now()->diffInSeconds($last)) : self::REWARD_COOLDOWN;
            if ($last && $elapsed < self::REWARD_COOLDOWN) {
                return [
                    'claimed' => false,
                    'coins' => $u->coins ?? 0,
                    'next_in' => self::REWARD_COOLDOWN - $elapsed,
                ];
            }
            // Gunluk bonus plana gore: Free 500, Star 800, StarPRO 1200
            $amount = match ($u->plan_active) {
                'starpro' => 1200,
                'star' => 800,
                default => self::REWARD_AMOUNT,
            };
            $u->coins = ($u->coins ?? 0) + $amount;
            $u->last_reward = now();
            $u->save();
            return [
                'claimed' => true,
                'reward' => $amount,
                'coins' => $u->coins,
                'next_in' => self::REWARD_COOLDOWN,
            ];
        });

        return response()->json($r);
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
                return $this->fail('Bu çerçeveye sahip değilsin.', 403);
            }
        }
        $u->avatar_frame = ($id === 'none') ? null : $id;
        $u->save();
        return response()->json(['avatar_frame' => $u->avatar_frame]);
    }
}
