<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\TournamentAd;

class TournamentAdController extends Controller
{
    // Herkese acik: ana sayfa slider'inda donen yayindaki bannerlar (siraya gore).
    // Her banner turnuva id + adiyla doner; tiklaninca o turnuvanin detayi acilir.
    public function index()
    {
        // ANA KAPATMA: admin paneldeki (/admin/tournament-ads) tek dugmeyle tum turnuva reklamlari
        // site genelinde gizlenebilir (kayitlar silinmeden). Kapaliysa bos liste -> BannerSlider
        // hic gostermez (collapse), hicbir reklam gorunmez.
        if (! Setting::bool('tournament_ads_enabled', true)) {
            return response()->json(['ads' => []]);
        }

        $ads = TournamentAd::with('organizer')
            ->where('published', true)
            ->whereNotNull('image')
            ->orderBy('sort')
            ->orderBy('id')
            ->limit(10)
            ->get()
            ->map(fn (TournamentAd $ad) => [
                'id' => $ad->id,
                'image' => $ad->image,
                // Secili kurum varsa onun logosu, yoksa elle yuklenen logo.
                'logo' => $ad->resolved_logo,
                'kicker' => $ad->kicker,
                'title' => $ad->title,
                'subtitle' => $ad->subtitle,
                'meta' => $ad->meta,
                'cta' => $ad->cta,
                'panel_color' => $ad->panel_color,
                'tournament_id' => $ad->tournament_id,
                'tournament_name' => $ad->tournament?->name,
                // Serbest hedef link (doluysa turnuva yerine buraya gidilir).
                'link' => $ad->link,
            ]);

        return response()->json(['ads' => $ads]);
    }
}
