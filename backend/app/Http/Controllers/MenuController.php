<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;

/**
 * Sol menu yapilandirmasi (halka acik, salt-okunur). Frontend acilista cekip pages.ts
 * uzerine uygular: sira, gorunurluk ve (varsa) ad override'lari. Ad override yoksa
 * o anahtar icin 'labels' bos gelir ve frontend i18n cevirisini kullanir.
 */
class MenuController extends Controller
{
    public function index()
    {
        $items = MenuItem::orderBy('sort')->orderBy('id')->get()->map(function (MenuItem $m) {
            $labels = array_filter([
                'tr' => $m->label_tr,
                'en' => $m->label_en,
                'es' => $m->label_es,
                'de' => $m->label_de,
                'fr' => $m->label_fr,
            ], fn ($v) => $v !== null && $v !== '');

            return [
                'key' => $m->key,
                'sort' => $m->sort,
                'visible' => (bool) $m->visible,
                'labels' => (object) $labels, // JSON'da her zaman nesne
            ];
        });

        return response()->json(['items' => $items]);
    }
}
