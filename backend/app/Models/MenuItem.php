<?php

namespace App\Models;

use App\Services\Translator;
use Illuminate\Database\Eloquent\Model;

/**
 * Sol menu ogesi (sira + ad override + gorunurluk). Katalog config/menu.php'dedir.
 * label_tr girilince EN/ES/DE/FR otomatik cevrilip saklanir; bosaltilinca hepsi
 * null olur ve frontend i18n cevirisine doner.
 */
class MenuItem extends Model
{
    protected $fillable = [
        'key', 'label_tr', 'label_en', 'label_es', 'label_de', 'label_fr', 'sort', 'visible', 'group',
    ];

    protected $casts = [
        'visible' => 'boolean',
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
    }

    /** Config'teki Turkce varsayilan ad (admin tablosunda sayfayi tanimak icin). */
    public function defaultLabel(): string
    {
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
                // Grup degismis olabilir (config guncellenirse) — divider dogru kalsin.
                static::where('key', $key)->where('group', '!=', $item['group'] ?? null)
                    ->update(['group' => $item['group'] ?? null]);

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
