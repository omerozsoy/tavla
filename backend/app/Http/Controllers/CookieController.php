<?php

namespace App\Http\Controllers;

use App\Models\CookieConsentSetting;
use App\Models\CookieEntry;

class CookieController extends Controller
{
    // Herkese acik: Cerez Politikasi tablosu (aktif cerezler, kategori+sira sirali).
    public function entries()
    {
        $rows = CookieEntry::where('active', true)
            ->orderBy('sort')->orderBy('id')
            ->get(['name', 'provider', 'purpose', 'category', 'duration']);

        return response()->json(['cookies' => $rows]);
    }

    // Herkese acik: cerez onay banner'i + tercih modali metinleri + consent surumu +
    // (varsa) analitik/pazarlama script ID'leri. Frontend consent kategorisine gore
    // ilgili script'i yukler; ID bossa hicbir sey yuklenmez.
    public function consent()
    {
        $s = CookieConsentSetting::current();

        return response()->json(['consent' => [
            'banner_title' => $s->banner_title,
            'banner_body' => $s->banner_body,
            'modal_title' => $s->modal_title,
            'modal_desc' => $s->modal_desc,
            'categories' => [
                'necessary' => $s->desc_necessary,
                'functional' => $s->desc_functional,
                'analytics' => $s->desc_analytics,
                'marketing' => $s->desc_marketing,
            ],
            'consent_version' => (int) ($s->consent_version ?: 1),
            'ga_id' => $s->ga_id,
            'gtm_id' => $s->gtm_id,
            'meta_pixel_id' => $s->meta_pixel_id,
        ]]);
    }
}
