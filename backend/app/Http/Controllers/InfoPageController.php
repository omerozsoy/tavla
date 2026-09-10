<?php

namespace App\Http\Controllers;

use App\Models\InfoPage;

class InfoPageController extends Controller
{
    // Herkese acik: yayinlanmis bilgi sayfalari (slug -> icerik). Frontend /bilgi sekmeleri.
    public function index()
    {
        $pages = InfoPage::where('published', true)
            ->orderBy('sort')->orderBy('id')
            ->get(['slug', 'title', 'body', 'gallery', 'galleries', 'sort']);
        return response()->json(['pages' => $pages]);
    }
}
