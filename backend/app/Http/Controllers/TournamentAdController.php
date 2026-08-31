<?php

namespace App\Http\Controllers;

use App\Models\TournamentAd;

class TournamentAdController extends Controller
{
    // Herkese acik: ana sayfada gosterilecek yayindaki reklamlar (en fazla 3, siraya gore).
    // Her reklam turnuva id + adiyla doner; tiklaninca o turnuvanin detayi acilir.
    public function index()
    {
        $ads = TournamentAd::where('published', true)
            ->whereNotNull('image')
            ->orderBy('sort')
            ->orderBy('id')
            ->limit(3)
            ->get()
            ->map(fn (TournamentAd $ad) => [
                'id' => $ad->id,
                'image' => $ad->image,
                'tournament_id' => $ad->tournament_id,
                'tournament_name' => $ad->tournament?->name,
            ]);

        return response()->json(['ads' => $ads]);
    }
}
