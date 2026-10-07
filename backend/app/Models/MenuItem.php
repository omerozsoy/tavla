<?php

namespace App\Models;

use App\Services\Translator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Sol menu ogesi (sira + ad override + gorunurluk). Katalog config/menu.php'dedir.
 * label_tr girilince EN/ES/DE/FR otomatik cevrilip saklanir; bosaltilinca hepsi
 * null olur ve frontend i18n cevirisine doner.
 */
class MenuItem extends Model
{
    protected $fillable = [
        'key', 'label_tr', 'label_en', 'label_es', 'label_de', 'label_fr', 'sort', 'visible', 'group', 'href', 'custom', 'icon',
        // Opsiyonel SAYFA metni override'ı (ör. Tek Oyun kurulum başlığı/açıklaması). TR girilir, gerisi otomatik.
        'title_tr', 'title_en', 'title_es', 'title_de', 'title_fr',
        'sub_tr', 'sub_en', 'sub_es', 'sub_de', 'sub_fr',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'custom' => 'boolean',
        'sort' => 'integer',
    ];

    protected static function booted(): void
    {
        // Admin yalnizca Turkce ad girer -> diger dilleri otomatik ceviririz.
        static::saving(function (MenuItem $m) {
            if (! $m->isDirty('label_tr')) {
                return;
            }
            $tr = trim((string) $m->label_tr);
            if ($tr === '') {
                $m->label_tr = null;
                $m->label_en = $m->label_es = $m->label_de = $m->label_fr = null;

                return;
            }
            $m->label_tr = $tr;
            foreach (['en', 'es', 'de', 'fr'] as $lang) {
                $m->{'label_'.$lang} = Translator::translate($tr, $lang) ?? $tr;
            }
        });

        // SAYFA metni (title_tr / sub_tr) da aynı şekilde: TR girilince otomatik çevir, boşsa null'la.
        static::saving(function (MenuItem $m) {
            foreach (['title', 'sub'] as $field) {
                if (! $m->isDirty($field.'_tr')) {
                    continue;
                }
                $tr = trim((string) $m->{$field.'_tr'});
                if ($tr === '') {
                    foreach (['tr', 'en', 'es', 'de', 'fr'] as $lang) {
                        $m->{$field.'_'.$lang} = null;
                    }

                    continue;
                }
                $m->{$field.'_tr'} = $tr;
                foreach (['en', 'es', 'de', 'fr'] as $lang) {
                    $m->{$field.'_'.$lang} = Translator::translate($tr, $lang) ?? $tr;
                }
            }
        });

        // SPA fallback dinamik allowlist cache'ini anında tazele (href değişince refresh 404 olmasın).
        $bust = fn () => Cache::forget('spa_menu_route_segs');
        static::saved($bust);
        static::deleted($bust);
    }

    /** Config'teki Turkce varsayilan ad (admin tablosunda sayfayi tanimak icin). */
    public function defaultLabel(): string
    {
        // Özel (admin-eklemeli) öğe: kataloğda yok -> girilen ad, yoksa hedef.
        if ($this->custom) {
            return $this->label_tr ?: ($this->href ?: $this->key);
        }
        foreach (config('menu.items', []) as $item) {
            if (($item['key'] ?? null) === $this->key) {
                return $item['label'] ?? $this->key;
            }
        }

        return $this->key;
    }

    /**
     * config/menu.php katalogundaki her anahtar icin satir oldugundan emin ol
     * (idempotent). Mevcut satirlarin sira/ad/gorunurlugu KORUNUR; yalnizca eksik
     * anahtarlar, katalog sirasinin sonuna eklenir.
     */
    public static function syncCatalog(): void
    {
        $items = config('menu.items', []);
        $existing = static::pluck('key')->all();
        $maxSort = (int) (static::max('sort') ?? -1);
        foreach ($items as $i => $item) {
            $key = $item['key'] ?? null;
            if (! $key) {
                continue;
            }
            if (in_array($key, $existing, true)) {
                // Mevcut item'in GRUBU admin'e aittir (Sol Menu'den degistirilebilir) ->
                // config degisse bile EZME. Yalnizca eksik anahtarlar asagida eklenir.
                continue;
            }
            static::create([
                'key' => $key,
                'group' => $item['group'] ?? null,
                'sort' => count($existing) === 0 ? $i : ++$maxSort, // ilk tohum config sirasi
                'visible' => true,
            ]);
        }
    }
}
