<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Hukuki/yasal sayfa (KVKK, Gizlilik, Cerez Politikasi, Kullanim Kosullari, Uyelik Sozlesmesi).
// Admin panelden duzenlenir; frontend icerigi slug ile ceker.
class LegalPage extends Model
{
    protected $fillable = [
        'slug', 'title', 'seo_title', 'seo_description', 'body', 'active', 'sort',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    // Sabit hukuki sayfa slug'lari (frontend route'lari ile birebir).
    public const SLUGS = [
        'kvkk',
        'gizlilik-politikasi',
        'cerez-politikasi',
        'kullanim-kosullari',
        'uyelik-sozlesmesi',
    ];
}
