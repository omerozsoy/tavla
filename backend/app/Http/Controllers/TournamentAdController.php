<?php

namespace App\Http\Controllers;

use App\Models\TournamentAd;

class TournamentAdController extends Controller
{
    // Herkese acik: ana sayfa slider'inda donen yayindaki bannerlar (siraya gore).
    // Her banner turnuva id + adiyla doner; tiklaninca o turnuvanin detayi acilir.
    public function index()
    {
        $ads = TournamentAd::where('published', true)
            ->whereNotNull('image')
            ->orderBy('sort')
            ->orderBy('id')
            ->limit(10)
            ->get()
            ->map(fn (TournamentAd $ad) => [
                'id' => $ad->id,
                'image' => $ad->image,
                'kicker' => $ad->kicker,
                'title' => $ad->title,
                'subtitle' => $ad->subtitle,
                'meta' => $ad->meta,
                'cta' => $ad->cta,
                'panel_color' => $ad->panel_color,
                'tournament_id' => $ad->tournament_id,
                'tournament_name' => $ad->tournament?->name,
            ]);

        return response()->json(['ads' => $ads]);
    }
}
