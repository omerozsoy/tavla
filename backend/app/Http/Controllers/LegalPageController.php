<?php

namespace App\Http\Controllers;

use App\Models\LegalPage;

class LegalPageController extends Controller
{
    // Herkese acik: aktif hukuki sayfalarin listesi (footer/menu icin — slug + baslik).
    public function index()
    {
        $pages = LegalPage::where('active', true)
            ->orderBy('sort')->orderBy('id')
            ->get(['slug', 'title'])
            ->map(fn (LegalPage $p) => ['slug' => $p->slug, 'title' => $p->title]);

        return response()->json(['pages' => $pages]);
    }

    // Herkese acik: tek hukuki sayfa (aktifse). Govde HTML + SEO alanlari.
    public function show(string $slug)
    {
        $p = LegalPage::where('slug', $slug)->where('active', true)->first();
        if (! $p) {
            return response()->json(['page' => null], 404);
        }

        return response()->json(['page' => [
            'slug' => $p->slug,
            'title' => $p->title,
            'seo_title' => $p->seo_title,
            'seo_description' => $p->seo_description,
            'body' => $p->body,
        ]]);
    }
}
