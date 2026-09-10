<?php

namespace App\Http\Controllers;

use App\Models\InfoPage;

class InfoPageController extends Controller
{
    // Herkese acik: yayinlanmis bilgi sayfalari (slug -> icerik). Frontend /bilgi sekmeleri.
    public function index()
    {
        // Hukuki sayfalar (kvkk/gizlilik/...) burada DONMEZ; onlar /api/legal-pages ile
        // servis edilir (Bilgi modali fetch'ini gereksiz buyutmemek icin).
        $pages = InfoPage::where('published', true)
            ->whereNotIn('slug', InfoPage::LEGAL_SLUGS)
            ->orderBy('sort')->orderBy('id')
            ->get(['slug', 'title', 'body', 'gallery', 'galleries', 'sort']);
        return response()->json(['pages' => $pages]);
    }
}
