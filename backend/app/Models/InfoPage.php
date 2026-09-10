<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Bilgi sayfalari: /bilgi/<slug> sekmeleri (about/services/...) + HUKUKI sayfalar
 *  (kvkk/gizlilik-politikasi/...). Hepsi admin panelden (Bilgi Sayfalari) RichEditor ile
 *  duzenlenir. Slug sabittir. Hukuki sayfalar frontend'de kendi rotalarinda gosterilir. */
class InfoPage extends Model
{
    protected $fillable = ['slug', 'title', 'seo_title', 'seo_description', 'body', 'gallery', 'galleries', 'sort', 'published'];

    protected $casts = [
        'gallery' => 'array',
        'galleries' => 'array',
        'published' => 'boolean',
    ];

    // Hukuki/yasal sayfa slug'lari (frontend rotalari ile birebir; /bilgi/ ONEKI YOK).
    public const LEGAL_SLUGS = [
        'kvkk',
        'gizlilik-politikasi',
        'cerez-politikasi',
        'kullanim-kosullari',
        'uyelik-sozlesmesi',
    ];

    // "Bilgi" modal sekmesi olan (duzenlenebilir metin) slug'lar — hukuki sayfalar HARIC.
    public const INFO_TAB_SLUGS = ['about', 'services'];
}
