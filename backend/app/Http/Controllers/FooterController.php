<?php

namespace App\Http\Controllers;

use App\Models\FooterColumn;
use App\Models\FooterLink;
use App\Models\Sponsor;
use Illuminate\Support\Facades\Schema;

/**
 * Footer kolon yapılandırması (admin panelden sıra/başlık/görünürlük) — açık uç.
 * Frontend (App.tsx) footerColumns'u bu config'e göre dizer: sıra, görünürlük ve
 * başlık override (labels[lang]; boş -> i18n foot.* varsayılanı). MenuController ile aynı desen.
 */
class FooterController extends Controller
{
    public function index()
    {
        // Migration henüz çalışmadıysa boş dön (frontend varsayılan sabit sırayı kullanır).
        if (! Schema::hasTable('footer_columns')) {
            return response()->json(['columns' => []]);
        }

        $columns = FooterColumn::orderBy('sort')->orderBy('id')->get()->map(function (FooterColumn $c) {
            $labels = array_filter([
                'tr' => $c->label_tr,
                'en' => $c->label_en,
                'es' => $c->label_es,
                'de' => $c->label_de,
                'fr' => $c->label_fr,
            ], fn ($v) => $v !== null && $v !== '');

            return [
                'key' => $c->key,
                'sort' => (int) $c->sort,
                'visible' => (bool) $c->visible,
                'labels' => (object) $labels, // boş -> frontend i18n varsayılanına düşer
            ];
        });

        // Kolon İÇİ link sıralaması/görünürlüğü/başlığı (footer_links). Migration yoksa boş.
        $links = Schema::hasTable('footer_links')
            ? FooterLink::orderBy('sort')->orderBy('id')->get()->map(function (FooterLink $l) {
                $labels = array_filter([
                    'tr' => $l->label_tr,
                    'en' => $l->label_en,
                    'es' => $l->label_es,
                    'de' => $l->label_de,
                    'fr' => $l->label_fr,
                ], fn ($v) => $v !== null && $v !== '');

                return [
                    'key' => $l->item_key,
                    'column' => $l->column_key,
                    'sort' => (int) $l->sort,
                    'visible' => (bool) $l->visible,
                    'labels' => (object) $labels, // boş -> frontend kendi varsayılan etiketini kullanır
                ];
            })
            : [];

        // Sponsorlar (footer karusel şeridi): sadece görünürler, sıraya göre. Migration yoksa boş.
        $sponsors = Schema::hasTable('sponsors')
            ? Sponsor::where('visible', true)->orderBy('sort')->orderBy('id')->get()->map(fn (Sponsor $s) => [
                'name' => $s->name,
                'logo' => $s->logo,
                'link' => $s->link,
            ])
            : [];

        return response()->json(['columns' => $columns, 'links' => $links, 'sponsors' => $sponsors]);
    }
}
