<?php

namespace App\Http\Controllers;

use App\Models\AdSlot;

class AdSlotController extends Controller
{
    // Herkese acik: ana sayfada paneller arasinda gosterilen yayindaki reklam seritleri.
    // Slota gore siralanir; frontend her konumda ilgili slotun ilk reklamini gosterir.
    public function index()
    {
        $ads = AdSlot::where('published', true)
            ->whereNotNull('image')
            ->orderBy('sort')
            ->orderBy('id')
            ->limit(30)
            ->get()
            ->map(fn (AdSlot $ad) => [
                'id' => $ad->id,
                'slot' => $ad->slot,
                'image' => $ad->image,
                'image_mobile' => $ad->image_mobile,
                'link' => $ad->link,
            ]);

        return response()->json(['ads' => $ads]);
    }
}
