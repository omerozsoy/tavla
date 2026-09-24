<?php

namespace App\Http\Controllers;

use App\Models\Setting;

/**
 * Google Etiketi (gtag.js / Google Ads dönüşüm) yapılandırması — HALKA AÇIK uç.
 * SPA (App boot) bunu okur: enabled + id doluysa gtag script'ini DINAMIK yükler. Admin panelden
 * (Ayarlar > Site Ayarları > Google Etiketi) açılır/kapatılır ve id değiştirilir. Ayar cache'li.
 */
class SiteTagController extends Controller
{
    public function index()
    {
        $id = trim(Setting::get('gtag_id', ''));
        $enabled = Setting::bool('gtag_enabled', false) && $id !== '';

        return response()->json([
            'gtag' => [
                'enabled' => $enabled,
                'id' => $enabled ? $id : null,
            ],
        ]);
    }
}
