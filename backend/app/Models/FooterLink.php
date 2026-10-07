<?php

namespace App\Models;

use App\Services\Translator;
use Illuminate\Database\Eloquent\Model;

/**
 * Footer bağlantısı (admin-yönetimli): bir kolonun İÇİNDEKİ tek bir linkin SIRA + GÖRÜNÜRLÜK +
 * BAŞLIK override'ı. Kolon başlığı/sırası FooterColumn'da; bu model kolon ÖĞELERİNİ yönetir.
 * item_key frontend'deki footer öğesinin key'iyle BİREBİR eşleşir (pages.ts katalog key'i ya da
 * App.tsx'teki SEO/bilgi/yasal öğe key'i). label_tr girilince EN/ES/DE/FR otomatik çevrilir;
 * boşaltılınca hepsi null olur ve frontend kendi varsayılan etiketine (i18n / sabit) düşer.
 * CMS (Bilgi Sayfaları) linkleri BURADA YOK — onlar info_pages.sort ile sıralanır.
 */
class FooterLink extends Model
{
    protected $fillable = [
        'item_key', 'column_key', 'label_tr', 'label_en', 'label_es', 'label_de', 'label_fr', 'sort', 'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'sort' => 'integer',
    ];

    /**
     * Sabit footer öğeleri: sıra (kolon içinde) ve admin görünüm etiketi. Frontend'deki
     * footer öğe key'leriyle (App.tsx footerColumns) BİREBİR. Seed + admin bu tek kaynaktan.
     *
     * @var array<int,array{key:string,column:string,label:string}>
     */
    public const ITEMS = [
        // Oyun
        ['key' => 'solo', 'column' => 'game', 'label' => 'Tek Oyun'],
        ['key' => 'match', 'column' => 'game', 'label' => 'Maç Oyunu'],
        ['key' => 'aiGame', 'column' => 'game', 'label' => 'Yapay Zeka ile Oyna'],
        ['key' => 'playFriend', 'column' => 'game', 'label' => 'Arkadaşınla Oyna'],
        // Topluluk
        ['key' => 'tournaments', 'column' => 'community', 'label' => 'Turnuvalar'],
        ['key' => 'leaderboard', 'column' => 'community', 'label' => 'Lider Tablosu'],
        ['key' => 'friends', 'column' => 'community', 'label' => 'Arkadaşlar'],
        ['key' => 'calendar', 'column' => 'community', 'label' => 'Turnuva Takvimi'],
        ['key' => 'clubs', 'column' => 'community', 'label' => 'Kulüpler'],
        // İçerik
        ['key' => 'news', 'column' => 'content', 'label' => 'Haberler'],
        ['key' => 'magazine', 'column' => 'content', 'label' => 'Tavla Magazin'],
        // Eğitim / Rehber
        ['key' => 'seo-online-tavla', 'column' => 'guide', 'label' => 'Online Tavla Oyna'],
        ['key' => 'seo-tavla-oyna', 'column' => 'guide', 'label' => 'Tavla Oyna'],
        ['key' => 'seo-nasil-oynanir', 'column' => 'guide', 'label' => 'Nasıl Oynanır'],
        ['key' => 'seo-tavla-rehberi', 'column' => 'guide', 'label' => 'Tavla Rehberi'],
        ['key' => 'seo-turnuva-kurallari', 'column' => 'guide', 'label' => 'Turnuva Kuralları'],
        ['key' => 'seo-sikca-sorulan', 'column' => 'guide', 'label' => 'Sıkça Sorulan Sorular'],
        // Organizasyon
        ['key' => 'org-hub', 'column' => 'organization', 'label' => 'Tavla Turnuvası Organizasyonu'],
        ['key' => 'org-kurumsal', 'column' => 'organization', 'label' => 'Kurumsal Tavla Turnuvası'],
        ['key' => 'org-belediye', 'column' => 'organization', 'label' => 'Belediye Tavla Turnuvası'],
        ['key' => 'org-avm', 'column' => 'organization', 'label' => 'AVM Tavla Turnuvası'],
        // Bilgi
        ['key' => 'info-about', 'column' => 'info', 'label' => 'Hakkında'],
        ['key' => 'info-services', 'column' => 'info', 'label' => 'Hizmetler'],
        ['key' => 'info-glossary', 'column' => 'info', 'label' => 'Sözlük'],
        ['key' => 'info-ranks', 'column' => 'info', 'label' => 'Rütbeler'],
        ['key' => 'info-scoring', 'column' => 'info', 'label' => 'Puanlama'],
        ['key' => 'info-badges', 'column' => 'info', 'label' => 'Başarılarım'],
        ['key' => 'info-fair', 'column' => 'info', 'label' => 'Adil Zar'],
        ['key' => 'org-iletisim', 'column' => 'info', 'label' => 'İletişim'],
        // Yasal
        ['key' => 'legal-kvkk', 'column' => 'legal', 'label' => 'KVKK Aydınlatma Metni'],
        ['key' => 'legal-gizlilik', 'column' => 'legal', 'label' => 'Gizlilik Politikası'],
        ['key' => 'legal-cerez', 'column' => 'legal', 'label' => 'Çerez Politikası'],
        ['key' => 'legal-kullanim', 'column' => 'legal', 'label' => 'Kullanım Koşulları'],
        ['key' => 'legal-uyelik', 'column' => 'legal', 'label' => 'Üyelik Sözleşmesi'],
        ['key' => 'legal-cerez-tercih', 'column' => 'legal', 'label' => 'Çerez Tercihleri'],
    ];

    protected static function booted(): void
    {
        // Admin yalnız Türkçe başlık girer -> diğer diller otomatik çevrilir (FooterColumn ile aynı).
        static::saving(function (FooterLink $l) {
            if (! $l->isDirty('label_tr')) {
                return;
            }
            $tr = trim((string) $l->label_tr);
            if ($tr === '') {
                $l->label_tr = null;
                $l->label_en = $l->label_es = $l->label_de = $l->label_fr = null;

                return;
            }
            $l->label_tr = $tr;
            foreach (['en', 'es', 'de', 'fr'] as $lang) {
                $l->{'label_'.$lang} = Translator::translate($tr, $lang) ?? $tr;
            }
        });
    }

    /** Admin tablosunda okunur ad: item_key'in Türkçe varsayılan etiketi (ITEMS). */
    public function defaultLabel(): string
    {
        foreach (self::ITEMS as $it) {
            if ($it['key'] === $this->item_key) {
                return $it['label'];
            }
        }

        return $this->item_key;
    }
}
