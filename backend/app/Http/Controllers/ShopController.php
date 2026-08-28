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
    // Premium tahta temalari
    private const THEMES = [
        'theme.gold' => 500,
        'theme.neon' => 800,
        'theme.ocean' => 300,
        'theme.sunset' => 600,
    ];

    // Avatar cerceve animasyonlari -> rarity (frontend avatarFrames.ts ANIMS ile BIREBIR, 106 adet).
    // 5 kademe: Standart(common) < Nadir(rare) < Epik(epic) < Efsanevi(legendary) < Mitik(mythic).
    private const FRAME_MOTIONS = [
        // Standart (250) — 26
        'pulse' => 'common', 'heartbeat' => 'common', 'heartScale' => 'common', 'vibrate' => 'common',
        'bounce' => 'common', 'pop' => 'common', 'sway' => 'common', 'rock' => 'common', 'pendulum' => 'common',
        'swing' => 'common', 'static' => 'common', 'hover' => 'common', 'breathe' => 'common', 'fade' => 'common',
        'float' => 'common', 'nudge' => 'common', 'tilt' => 'common', 'spinSlow' => 'common', 'drift' => 'common',
        'saturate' => 'common', 'contrast' => 'common', 'grayscale' => 'common', 'sepia' => 'common',
        'wiggle' => 'common', 'shiver' => 'common', 'floatSide' => 'common',
        // Nadir (500) — 24
        'pulseFast' => 'rare', 'jelly' => 'rare', 'gelatine' => 'rare', 'levitate' => 'rare', 'wobble' => 'rare',
        'circleMove' => 'rare', 'expand' => 'rare', 'seesaw' => 'rare', 'sweep' => 'rare', 'glint' => 'rare',
        'bright' => 'rare', 'shineOnce' => 'rare', 'ripple' => 'rare', 'flip3d' => 'rare', 'invert' => 'rare',
        'flicker' => 'rare', 'ember' => 'rare', 'spin' => 'rare', 'sheen' => 'rare', 'blur' => 'rare',
        'squash' => 'rare', 'rubber' => 'rare', 'headShake' => 'rare', 'throb' => 'rare',
        // Epik (1000) — 22
        'glowPulse' => 'epic', 'tada' => 'epic', 'sweepFast' => 'epic', 'gradSpin' => 'epic', 'radar' => 'epic',
        'auraPulse' => 'epic', 'hueCycle' => 'epic', 'dualSweep' => 'epic', 'pulseHalo' => 'epic', 'sweepRev' => 'epic',
        'trace' => 'epic', 'gradPulse' => 'epic', 'shimmer' => 'epic', 'sparkle' => 'epic', 'orbit' => 'epic',
        'twist' => 'epic', 'spinPulse' => 'epic', 'flipX' => 'epic', 'blob' => 'epic', 'hueWobble' => 'epic',
        'ringPulse' => 'epic', 'skewPulse' => 'epic',
        // Efsanevi (2000) — 19
        'rainbow' => 'legendary', 'rain' => 'legendary', 'sparkleBurst' => 'legendary', 'dualOrbit' => 'legendary',
        'dualRipple' => 'legendary', 'neonPulse' => 'legendary', 'sonar' => 'legendary', 'twinkle' => 'legendary',
        'comet' => 'legendary', 'aura' => 'legendary', 'barrelRoll' => 'legendary', 'coinFlip' => 'legendary',
        'tumble' => 'legendary', 'dropGlow' => 'legendary', 'pulseSweep' => 'legendary', 'haloSpin' => 'legendary',
        'figure8' => 'legendary', 'diagonal' => 'legendary', 'bloom' => 'legendary',
        // Mitik (4000) — 15
        'conicRainbow' => 'mythic', 'loading' => 'mythic', 'rising' => 'mythic', 'zoomBlur' => 'mythic',
        'gyro' => 'mythic', 'spinY3d' => 'mythic', 'spinX3d' => 'mythic', 'drawRing' => 'mythic',
        'dashSpin' => 'mythic', 'dashFlow' => 'mythic', 'gradWave' => 'mythic', 'duotone' => 'mythic',
        'glowSpread' => 'mythic', 'fireflies' => 'mythic', 'flash' => 'mythic',
    ];

    private const RARITY_PRICE = ['common' => 250, 'rare' => 500, 'epic' => 1000, 'legendary' => 2000, 'mythic' => 4000];

    // Tam katalog: temalar + 106 cerceve (anim basina tek; id: 'frame.<motion>').
    private function catalog(): array
    {
        $c = self::THEMES;
        foreach (self::FRAME_MOTIONS as $motion => $rarity) {
            $c["frame.$motion"] = self::RARITY_PRICE[$rarity];
        }

        return $c;
    }

    public function index(Request $request)
    {
        $u = $request->user();
        return response()->json([
            'catalog' => $this->catalog(),
            'unlocks' => $u->unlocks ?? [],
            'avatar_frame' => $u->avatar_frame,
            'coins' => $u->coins ?? 0,
        ]);
    }

    public function buy(Request $request)
    {
        $data = $request->validate(['id' => ['required', 'string', 'max:40']]);
        $id = $data['id'];
        $catalog = $this->catalog();
        if (! array_key_exists($id, $catalog)) {
            return $this->fail('Ürün bulunamadı.', 404);
        }
        $price = $catalog[$id];

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
