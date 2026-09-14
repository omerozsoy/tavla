<?php

namespace App\Http\Controllers;

use App\Models\MenuGroup;
use App\Models\MenuItem;

/**
 * Sol menu yapilandirmasi (halka acik, salt-okunur). Frontend acilista cekip pages.ts
 * uzerine uygular: item sirasi/gorunurlugu/ad + GRUP atamasi (item.group) ve grup
 * basliklari/sirasi (groups). Override yoksa frontend pages.ts + i18n varsayilanina duser.
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
                'group' => $m->group, // admin grup atamasi (null -> pages.ts varsayilani)
                'labels' => (object) $labels, // JSON'da her zaman nesne
            ];
        });

        // Grup basliklari (admin "Menu Gruplari"). Bos ise frontend i18n varsayilanina duser.
        $groups = MenuGroup::orderBy('sort')->orderBy('id')->get()->map(function (MenuGroup $g) {
            $labels = array_filter([
                'tr' => $g->label_tr,
                'en' => $g->label_en,
                'es' => $g->label_es,
                'de' => $g->label_de,
                'fr' => $g->label_fr,
            ], fn ($v) => $v !== null && $v !== '');

            return [
                'key' => $g->key,
                'sort' => $g->sort,
                'visible' => (bool) $g->visible,
                'labels' => (object) $labels,
            ];
        });

        return response()->json(['items' => $items, 'groups' => $groups]);
    }
}
