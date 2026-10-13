<?php

namespace App\Http\Controllers;

use App\Models\EntryPopup;
use App\Models\Setting;

class EntryPopupController extends Controller
{
    // Herkese acik: siteye ilk girildiginde gosterilecek KARE pop-up. Yayindaki + gorseli olan
    // ILK kayit (sort,id) dondurulur; yoksa null. Gosterim sikligi/hedef kitle gate'lemesini
    // frontend yapar (audience: login durumu, frequency: localStorage). 'v' = surum (updated_at):
    // gorsel degisince frontend yeniden gosterir.
    public function index()
    {
        // ANA KAPATMA: admin paneldeki (/admin/entry-popups) tek dugmeyle giris popup'i site
        // genelinde kapatilabilir (kayitlar silinmeden). Kapaliysa null -> frontend hic acmaz.
        if (! Setting::bool('entry_popup_enabled', true)) {
            return response()->json(['popup' => null]);
        }

        $p = EntryPopup::where('published', true)
            ->whereNotNull('image')
            ->orderBy('sort')
            ->orderBy('id')
            ->first();

        if (! $p) {
            return response()->json(['popup' => null]);
        }

        return response()->json(['popup' => [
            'id' => $p->id,
            'image' => $p->image,
            'image_mobile' => $p->image_mobile,
            'link' => $p->link,
            'frequency' => $p->frequency,
            'audience' => $p->audience,
            'v' => optional($p->updated_at)->timestamp ?? 0,
        ]]);
    }
}
