<?php

namespace App\Models;

use App\Services\Translator;
use Illuminate\Database\Eloquent\Model;

/**
 * Footer bağlantı kolonu (admin-yönetimli). 7 sabit kolon: game/community/content/guide/
 * organization/info/legal. label_tr girilince EN/ES/DE/FR otomatik çevrilir; boşaltılınca
 * hepsi null olur ve frontend i18n varsayılanına düşer. Sıra = 'sort'; 'visible' false ise
 * kolon footer'da HİÇ görünmez. Kolon ÖĞELERİ (linkler) frontend'de (pages.ts + App).
 */
class FooterColumn extends Model
{
    protected $fillable = [
        'key', 'label_tr', 'label_en', 'label_es', 'label_de', 'label_fr', 'sort', 'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'sort' => 'integer',
    ];

    /** Sabit kolonların Türkçe varsayılan başlıkları (i18n foot.* / menu.info ile aynı). */
    public const DEFAULTS = [
        'game' => 'Oyun',
        'community' => 'Topluluk',
        'content' => 'İçerik',
        'guide' => 'Eğitim',
        'organization' => 'Organizasyon',
        'info' => 'Bilgi',
        'legal' => 'Yasal',
    ];

    protected static function booted(): void
    {
        // Admin yalnız Türkçe başlık girer -> diğer diller otomatik çevrilir (MenuGroup ile aynı).
        static::saving(function (FooterColumn $c) {
            if (! $c->isDirty('label_tr')) {
                return;
            }
            $tr = trim((string) $c->label_tr);
            if ($tr === '') {
                $c->label_tr = null;
                $c->label_en = $c->label_es = $c->label_de = $c->label_fr = null;

                return;
            }
            $c->label_tr = $tr;
            foreach (['en', 'es', 'de', 'fr'] as $lang) {
                $c->{'label_'.$lang} = Translator::translate($tr, $lang) ?? $tr;
            }
        });
    }

    /** Admin tablosunda ipucu/placeholder: kolonun Türkçe varsayılan başlığı. */
    public function defaultLabel(): string
    {
        return self::DEFAULTS[$this->key] ?? $this->key;
    }
}
