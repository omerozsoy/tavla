<?php

namespace App\Http\Controllers;

use App\Models\MenuGroup;
use App\Models\MenuItem;
use App\Support\Brand;

/**
 * Sol menu yapilandirmasi (halka acik, salt-okunur). Frontend acilista cekip pages.ts
 * uzerine uygular: item sirasi/gorunurlugu/ad + GRUP atamasi (item.group) ve grup
 * basliklari/sirasi (groups). Override yoksa frontend pages.ts + i18n varsayilanina duser.
 */
class MenuController extends Controller
{
    public function index()
    {
        // GammonTV'de menü gammon'a özel sadeleştirilebilir (göster/gizle + grup ismi), tavlatv
        // etkilenmeden. NULL override = tavlatv değerinden miras.
        $isGammon = Brand::keyFromHost(request()?->getHost()) === 'gammon';

        $items = MenuItem::orderBy('sort')->orderBy('id')->get()->map(function (MenuItem $m) use ($isGammon) {
            $langMap = fn (string $field) => array_filter([
                'tr' => $m->{$field.'_tr'},
                'en' => $m->{$field.'_en'},
                'es' => $m->{$field.'_es'},
                'de' => $m->{$field.'_de'},
                'fr' => $m->{$field.'_fr'},
            ], fn ($v) => $v !== null && $v !== '');
            $labels = $langMap('label');
            $title = $langMap('title'); // opsiyonel sayfa başlığı override'ı (boş -> frontend i18n)
            $sub = $langMap('sub');     // opsiyonel sayfa açıklaması override'ı

            // gammon: gammon_visible doluysa onu kullan, değilse tavlatv visible'ından miras.
            $visible = $isGammon && $m->gammon_visible !== null ? (bool) $m->gammon_visible : (bool) $m->visible;

            return [
                'key' => $m->key,
                'sort' => $m->sort,
                'visible' => $visible,
                'group' => $m->group, // admin grup atamasi (null -> pages.ts varsayilani)
                'labels' => (object) $labels, // JSON'da her zaman nesne
                'title' => (object) $title, // sayfa başlığı override (dil -> metin)
                'sub' => (object) $sub,     // sayfa açıklaması override (dil -> metin)
                'custom' => (bool) $m->custom, // admin-eklemeli özel öğe mi
                'href' => $m->custom ? ($m->href ?: null) : null, // özel öğe hedefi (/rota veya https://...)
                'icon' => $m->icon ?: null, // admin-secili ikon (bos -> frontend slug'tan turetir)
            ];
        });

        // Grup basliklari (admin "Menu Gruplari"). Bos ise frontend i18n varsayilanina duser.
        $groups = MenuGroup::orderBy('sort')->orderBy('id')->get()->map(function (MenuGroup $g) use ($isGammon) {
            // gammon'da grup ismi: gammon_label doluysa EN etiketini onunla ez (gammon EN gösterir).
            $enLabel = $isGammon && $g->gammon_label !== null && $g->gammon_label !== ''
                ? $g->gammon_label
                : $g->label_en;
            $labels = array_filter([
                'tr' => $g->label_tr,
                'en' => $enLabel,
                'es' => $g->label_es,
                'de' => $g->label_de,
                'fr' => $g->label_fr,
            ], fn ($v) => $v !== null && $v !== '');

            // gammon: grup görünürlüğü de gammon_visible'dan miras alınabilir.
            $gVisible = $isGammon && $g->gammon_visible !== null ? (bool) $g->gammon_visible : (bool) $g->visible;

            return [
                'key' => $g->key,
                'sort' => $g->sort,
                // removed (tombstone) -> menude gorunmez; frontend visible=false'ta grup+ogeleri gizler.
                'visible' => $gVisible && ! $g->removed,
                'collapsed' => (bool) $g->collapsed, // menude katli mi baslar (varsayilan)
                'labels' => (object) $labels,
            ];
        });

        return response()->json(['items' => $items, 'groups' => $groups]);
    }
}
