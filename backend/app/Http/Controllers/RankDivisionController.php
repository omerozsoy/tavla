<?php

namespace App\Http\Controllers;

use App\Support\RankDivisions;

/**
 * Rütbe eşikleri — HALKA AÇIK uç (SiteTagController ile aynı desen).
 * SPA boot'ta okur ve `src/badges.ts` DIVISIONS tablosunu bununla hidrate eder; böylece
 * yönetim panelinden (Ayarlar > Rating Ayar) değiştirilen eşikler YENİ BUILD GEREKTİRMEDEN
 * canlıya yansır. Ayar cache'li (Setting::map), uç ucuzdur.
 *
 *  - `divisions` : kademe => rating ALT eşiği (kesin artan)
 *  - `prMax`     : kademe => PR ÜST eşiği (kesin azalan; PR düşük = iyi).
 *                  Rookie YOKTUR — sonsuzdur ve JSON'da temsil edilemez; istemci
 *                  kendi Infinity varsayılanını korur.
 */
class RankDivisionController extends Controller
{
    public function index()
    {
        return response()->json([
            'divisions' => (object) RankDivisions::thresholds(),
            'prMax' => (object) RankDivisions::prThresholds(),
        ]);
    }
}
