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

    // Tahta nadirlik -> coin fiyati (frontend boardThemes.ts BOARD_RARITY_PRICE + CLUB_BOARD_PRICE ile BIREBIR).
    private const BOARD_PRICE = ['common' => 1000, 'rare' => 2000, 'epic' => 3000, 'legendary' => 4000, 'mythic' => 5000, 'club' => 1000];

    // Satin alinabilir tahta id -> nadirlik. Kaynak: src/boardThemes.ts (senkron tut).
    // Ucretsiz olanlar (standart/tavla/galaxy + kulup temalari) BURADA YOK.
    private const BOARD_RARITY = [
        // common (1000)
        'pumpkin' => 'common', 'marrakesh' => 'common', 'bosphorus' => 'common', 'manhattan' => 'common',
        'redplanet' => 'common', 'glacier' => 'common', 'atlantis' => 'common', 'amethyst' => 'common',
        'radioactive' => 'common', 'gaia' => 'common', 'lunar' => 'common', 'monaco' => 'common',
        'violetstorm' => 'common', 'blueorbit' => 'common', 'nord' => 'common', 'gruvbox' => 'common',
        'solarized' => 'common', 'mocha' => 'common', 'monokai' => 'common', 'everforest' => 'common',
        'ayu' => 'common', 'onedark' => 'common', 'palenight' => 'common', 'oceanic' => 'common',
        'gruvlight' => 'common', 'sollight' => 'common', 'dawn' => 'common', 'sahara' => 'common',
        'emerald' => 'common', 'arctic' => 'common', 'coral' => 'common', 'jade' => 'common',
        'ocean2' => 'common', 'lagoon' => 'common', 'lavender' => 'common', 'bazaar' => 'common', 'miami' => 'common',
        // rare (2000)
        'frostfall' => 'rare', 'worldmasters' => 'rare', 'retroclub' => 'rare', 'crimsonash' => 'rare',
        'ion' => 'rare', 'dracula' => 'rare', 'tokyonight' => 'rare', 'rosepine' => 'rare',
        'nightowl' => 'rare', 'horizon' => 'rare', 'ruby' => 'rare', 'royal' => 'rare',
        'cherry' => 'rare', 'copper' => 'rare', 'midnight' => 'rare', 'gold2' => 'rare',
        'gamma' => 'rare', 'cosmos' => 'rare', 'titan' => 'rare', 'jupiter' => 'rare',
        'helix' => 'rare', 'solaris' => 'rare', 'orion' => 'rare', 'kepler' => 'rare',
        // epic (3000)
        'reddwarf' => 'epic', 'eclipse' => 'epic', 'synthwave' => 'epic', 'ocean' => 'epic',
        'volcano' => 'epic', 'tokyo' => 'epic', 'aurora2' => 'epic', 'imperial' => 'epic',
        'andromeda' => 'epic', 'orbit' => 'epic', 'cassio' => 'epic', 'quasar' => 'epic',
        'polaris' => 'epic', 'apollo' => 'epic', 'aurora' => 'epic',
        // legendary (4000)
        'gold' => 'legendary', 'sunset' => 'legendary', 'obsidian' => 'legendary', 'samurai' => 'legendary',
        'blackdiamond' => 'legendary', 'gutenberg' => 'legendary', 'krypton' => 'legendary', 'infinity' => 'legendary',
        'vega' => 'legendary', 'quantum' => 'legendary', 'singularity' => 'legendary',
        // mythic (5000)
        'neon' => 'mythic', 'cyber' => 'mythic', 'inferno' => 'mythic',
        // club (1000)
        'fenerbahce' => 'club', 'galatasaray' => 'club', 'besiktas' => 'club', 'trabzonspor' => 'club',
    ];

    // Avatar cerceve animasyonlari -> rarity (frontend avatarFrames.ts ANIMS ile BIREBIR, 62 adet).
    // 5 kademe: Standart(common) < Nadir(rare) < Epik(epic) < Efsanevi(legendary) < Mitik(mythic).
    private const FRAME_MOTIONS = [
        // common (6)
        'pulse' => 'common', 'heartScale' => 'common', 'static' => 'common', 'grayscale' => 'common',
        'sepia' => 'common', 'floatSide' => 'common',
        // rare (16)
        'float' => 'rare', 'pulseFast' => 'rare', 'levitate' => 'rare', 'wobble' => 'rare',
        'expand' => 'rare', 'seesaw' => 'rare', 'sweep' => 'rare', 'glint' => 'rare',
        'bright' => 'rare', 'shineOnce' => 'rare', 'ripple' => 'rare', 'invert' => 'rare',
        'flicker' => 'rare', 'ember' => 'rare', 'sheen' => 'rare', 'blur' => 'rare',
        // epic (14)
        'tilt' => 'epic', 'glowPulse' => 'epic', 'sweepFast' => 'epic', 'radar' => 'epic',
        'auraPulse' => 'epic', 'hueCycle' => 'epic', 'pulseHalo' => 'epic', 'sweepRev' => 'epic',
        'orbit' => 'epic', 'hueWobble' => 'epic', 'ringPulse' => 'epic', 'bloom' => 'epic',
        'conicRainbow' => 'epic', 'duotone' => 'epic',
        // legendary (20)
        'sway' => 'legendary', 'gradSpin' => 'legendary', 'dualSweep' => 'legendary', 'gradPulse' => 'legendary',
        'blob' => 'legendary', 'rainbow' => 'legendary', 'rain' => 'legendary', 'sparkleBurst' => 'legendary',
        'dualOrbit' => 'legendary', 'dualRipple' => 'legendary', 'neonPulse' => 'legendary', 'sonar' => 'legendary',
        'twinkle' => 'legendary', 'comet' => 'legendary', 'aura' => 'legendary', 'barrelRoll' => 'legendary',
        'dropGlow' => 'legendary', 'pulseSweep' => 'legendary', 'haloSpin' => 'legendary', 'glowSpread' => 'legendary',
        // mythic (6)
        'vibrate' => 'mythic', 'pop' => 'mythic', 'tada' => 'mythic', 'loading' => 'mythic',
        'rising' => 'mythic', 'gradWave' => 'mythic',
    ];

    private const RARITY_PRICE = ['common' => 250, 'rare' => 500, 'epic' => 1000, 'legendary' => 2000, 'mythic' => 4000];

    // Tam katalog: tahtalar (nadirlik fiyati) + 62 cerceve (anim basina tek; id: 'frame.<motion>').
    private function catalog(): array
    {
        $c = [];
        foreach (self::BOARD_RARITY as $id => $rarity) {
            $c["theme.$id"] = self::BOARD_PRICE[$rarity];
        }
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
            // %-BAHİS KİLİDİ: oynanan bir % (bet_pct) maçta coin harcaması yasak (escrow'suz -> bakiye
            // eritip settle'ı eksik ödetme engeli). Sabit-stake ise aşağıdaki rezerv kontrolü yeter.
            if (\App\Models\Room::userInPctStakedPlaying($u->id)) {
                return ['pct_locked' => true, 'coins' => $u->coins ?? 0];
            }
            // KULLANILABİLİR bakiye = coins - coins_reserved (escrow). Bahisli maçta REZERVE edilmiş
            // coin mağazaya harcanamaz -> kaybeden stake'i maç sırasında eritip settle'ı eksik ödetemez.
            if ((($u->coins ?? 0) - ($u->coins_reserved ?? 0)) < $price) {
                return ['insufficient' => true, 'coins' => $u->coins ?? 0];
            }
            $u->coins = ($u->coins ?? 0) - $price;
            $unlocks[] = $id;
            $u->unlocks = $unlocks;
            $u->save();
            return ['unlocks' => $unlocks, 'coins' => $u->coins];
        });

        if (isset($r['pct_locked'])) {
            return $this->fail('Yüzde bahisli maçtayken coin harcayamazsın. Maç bitince tekrar dene.', 422, ['coins' => $r['coins']]);
        }
        if (isset($r['insufficient'])) {
            return $this->fail('Yetersiz coin.', 422, ['coins' => $r['coins']]);
        }
        if (isset($r['owned'])) {
            // Yumusak sonuc: zaten sahip (HATA degil) -> 200 + mesaj + guncel durum.
            return response()->json(['message' => 'Zaten sahipsin.', 'unlocks' => $r['unlocks'], 'coins' => $r['coins']]);
        }
        return response()->json(['unlocks' => $r['unlocks'], 'coins' => $r['coins']]);
    }

    private const REWARD_AMOUNT = 25; // 6 saatlik ödül (Free). Yeni ekonomi: 500 -> 25.
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
            // 6 saatlik bonus (admin ayarı): normal kullanıcı reward_normal (25), premium (star/starpro)
            // reward_premium (50). Ayarlar Site Ayarları'ndan yönetilir.
            $premium = in_array($u->plan_active, ['star', 'starpro'], true);
            $amount = $premium
                ? \App\Models\Setting::int('reward_premium', 50)
                : \App\Models\Setting::int('reward_normal', 25);
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
