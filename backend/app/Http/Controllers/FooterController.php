<?php

namespace App\Http\Controllers;

use App\Models\FooterColumn;
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

        return response()->json(['columns' => $columns]);
    }
}
