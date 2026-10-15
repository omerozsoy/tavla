<?php

namespace App\Models;

use App\Services\Translator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

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
        // CMS (Bilgi Sayfaları) satırı: cms-<slug> -> sayfanın başlığı.
        if (str_starts_with($this->item_key, 'cms-')) {
            return InfoPage::where('slug', substr($this->item_key, 4))->value('title') ?? $this->item_key;
        }

        return $this->item_key;
    }

    /**
     * CMS footer sayfalarını (info_pages.section = 'footer:<kolon>') footer_links satırı olarak
     * MATERYALİZE et — böylece sabit linklerle AYNI ekranda (Footer Bağlantıları) sürükle-sırala/
     * taşı/gizle/başlık düzenlenebilir. ListFooterLinks açılışta çağırır (tek senkron noktası).
     *  - Eksik cms-<slug> satırı oluştur (kolon section'dan, sort o kolonun sonu, görünür).
     *  - Var olan satırın kolon/sort/görünürlüğüne DOKUNMA (admin footer-links'ten yönetir).
     *  - footer section'ı kalkan/silinen CMS sayfanın satırını BUDA.
     * ponytail: 'cms-'+slug 64 karakteri aşarsa atla (item_key unique(64)); çok uzun slug'lı sayfa
     *           footer yöneticisine girmez ama section-enjeksiyonu ile sitede yine görünür.
     */
    public static function syncCmsRows(): void
    {
        if (! Schema::hasTable('info_pages') || ! Schema::hasTable('footer_links')) {
            return;
        }

        $wanted = []; // cms-<slug> => kolon
        foreach (InfoPage::where('section', 'like', 'footer:%')->get(['slug', 'section']) as $p) {
            $key = 'cms-'.$p->slug;
            if (strlen($key) > 64) {
                continue;
            }
            $wanted[$key] = explode(':', $p->section, 2)[1];
        }

        // Artık footer'da olmayan cms satırlarını buda.
        static::where('item_key', 'like', 'cms-%')
            ->whereNotIn('item_key', array_keys($wanted) ?: [''])
            ->delete();

        // Eksik olanları ilgili kolonun sonuna ekle.
        foreach ($wanted as $key => $col) {
            if (static::where('item_key', $key)->exists()) {
                continue;
            }
            static::create([
                'item_key' => $key,
                'column_key' => $col,
                'sort' => (int) static::where('column_key', $col)->max('sort') + 1,
                'visible' => true,
            ]);
        }
    }
}
