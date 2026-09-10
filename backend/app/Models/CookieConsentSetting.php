<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Cerez onay banner'i + tercih modali metinleri (tek satir). Tekil kayit: id=1.
class CookieConsentSetting extends Model
{
    protected $fillable = [
        'banner_title', 'banner_body', 'modal_title', 'modal_desc',
        'desc_necessary', 'desc_functional', 'desc_analytics', 'desc_marketing',
        'consent_version', 'ga_id', 'gtm_id', 'meta_pixel_id',
    ];

    protected $casts = [
        'consent_version' => 'integer',
    ];

    // Tekil ayar satirini getir (yoksa varsayilanlarla olustur).
    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1]);
    }
}
