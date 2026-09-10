<?php

namespace App\Http\Controllers;

use App\Models\InfoPage;

// Hukuki sayfalar (KVKK/gizlilik/cerez/kullanim/uyelik) info_pages tablosunda tutulur ve
// admin panelde "Bilgi Sayfalari" altindan duzenlenir. Bu controller yalniz hukuki slug'lari
// (InfoPage::LEGAL_SLUGS) herkese acik olarak servis eder.
class LegalPageController extends Controller
{
    public function index()
    {
        $pages = InfoPage::whereIn('slug', InfoPage::LEGAL_SLUGS)
            ->where('published', true)
            ->orderBy('sort')->orderBy('id')
            ->get(['slug', 'title'])
            ->map(fn (InfoPage $p) => ['slug' => $p->slug, 'title' => $p->title]);

        return response()->json(['pages' => $pages]);
    }

    public function show(string $slug)
    {
        if (! in_array($slug, InfoPage::LEGAL_SLUGS, true)) {
            return response()->json(['page' => null], 404);
        }
        $p = InfoPage::where('slug', $slug)->where('published', true)->first();
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
