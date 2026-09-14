<?php

namespace App\Models;

use App\Services\Translator;
use Illuminate\Database\Eloquent\Model;

/**
 * Sol menu GRUP basligi (admin-yonetimli bolum). label_tr girilince EN/ES/DE/FR otomatik
 * cevrilir; bosaltilinca hepsi null olur ve frontend i18n varsayilanina duser (bilinen 7
 * grup icin). Yeni grup eklenebilir; item'lar menu_items.group ile bir gruba baglanir.
 * Sira = 'sort'; 'visible' false ise baslik cizilmez (ogeler yine gorunur).
 */
class MenuGroup extends Model
{
    protected $fillable = [
        'key', 'label_tr', 'label_en', 'label_es', 'label_de', 'label_fr', 'sort', 'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'sort' => 'integer',
    ];

    protected static function booted(): void
    {
        // Admin yalnizca Turkce ad girer -> diger dilleri otomatik ceviririz (menu_items ile ayni).
        static::saving(function (MenuGroup $g) {
            if (! $g->isDirty('label_tr')) {
                return;
            }
            $tr = trim((string) $g->label_tr);
            if ($tr === '') {
                $g->label_tr = null;
                $g->label_en = $g->label_es = $g->label_de = $g->label_fr = null;

                return;
            }
            $g->label_tr = $tr;
            foreach (['en', 'es', 'de', 'fr'] as $lang) {
                $g->{'label_'.$lang} = Translator::translate($tr, $lang) ?? $tr;
            }
        });
    }

    /** Config'teki Turkce varsayilan baslik (admin tablosunda ipucu/placeholder). */
    public function defaultLabel(): string
    {
        foreach (config('menu.groups', []) as $g) {
            if (($g['key'] ?? null) === $this->key) {
                return (string) ($g['label'] ?? '');
            }
        }

        return '';
    }

    /**
     * config/menu.php 'groups' katalogundaki her grup icin satir oldugundan emin ol
     * (idempotent). Eksikler eklenir; mevcutlarin ad/sira/gorunurlugu KORUNUR. Etiketler
     * bos (null) tohumlanir -> bilinen gruplar frontend i18n varsayilanina duser (API yok).
     */
    public static function syncCatalog(): void
    {
        $groups = config('menu.groups', []);
        $existing = static::pluck('key')->all();
        $rows = [];
        foreach ($groups as $g) {
            $key = $g['key'] ?? null;
            if (! $key || in_array($key, $existing, true)) {
                continue;
            }
            $rows[] = [
                'key' => $key,
                'sort' => (int) ($g['sort'] ?? 0),
                'visible' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        if ($rows) {
            static::insert($rows); // model event YOK -> ceviri API cagrilmaz (etiketler null)
        }
    }
}
