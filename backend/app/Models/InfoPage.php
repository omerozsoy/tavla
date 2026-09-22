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

    // SEO icerik sayfalari: landing'ler + nasil-oynanir + turnuva kurallari + rehber yazilari.
    // Bu slug'lar admin panelden (Bilgi Sayfalari) RichEditor ile duzenlenebilir hale gelir.
    // Frontend'de body DB'de varsa onu render eder, yoksa hardcoded icerige duser (fallback).
    // NOT: bazi slug'lar '/' icerir (tavla-rehberi/<yazi>); admin URL gosterimi buna gore.
    public const SEO_SLUGS = [
        'online-tavla',
        'tavla-oyna',
        'nasil-oynanir',
        'turnuva-kurallari',
        'tavla-rehberi/tavla-acilis-stratejileri',
        'tavla-rehberi/tavla-kupu-doubling-cube',
        'tavla-rehberi/tavla-kazanma-taktikleri',
        'tavla-rehberi/mars-gammon-backgammon-nedir',
        // Turnuva organizasyonu SEO servis sayfalari + iletisim (footer "Organizasyon" kolonu).
        // Frontend ServiceLanding hardcoded fallback icerik gosterir; body doldurulursa onu render eder.
        'tavla-turnuvasi-organizasyonu',
        'kurumsal-tavla-turnuvasi',
        'belediye-tavla-turnuvasi',
        'avm-tavla-turnuvasi',
        'iletisim',
    ];
}
