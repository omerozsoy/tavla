<?php

namespace App\Http\Controllers;

use App\Support\RankDivisions;

/**
 * Rütbe rating eşikleri — HALKA AÇIK uç (SiteTagController ile aynı desen).
 * SPA boot'ta okur ve `src/badges.ts` DIVISIONS eşiklerini bununla hidrate eder; böylece
 * yönetim panelinden (Ayarlar > Rating Ayar) değiştirilen eşikler YENİ BUILD GEREKTİRMEDEN
 * canlıya yansır. Ayar cache'li (Setting::map), uç ucuzdur.
 */
class RankDivisionController extends Controller
{
    public function index()
    {
        return response()->json([
            'divisions' => (object) RankDivisions::thresholds(),
        ]);
    }
}
