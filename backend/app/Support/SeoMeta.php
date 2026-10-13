<?php

namespace App\Support;

use App\Models\Content;
use Illuminate\Support\Facades\Schema;

/**
 * Rota-başına SEO <head> enjeksiyonu (SPA statik index.html kabuğu düzeltmesi).
 *
 * SORUN: Frontend bir React SPA; sunucu HER iç rota için AYNI public/index.html'i
 * döndürüyordu -> her sayfa ana sayfanın canonical'ını + aynı title/description/og
 * + aynı <noscript> H1'ini taşıyordu. Google iç sayfaları "ana sayfanın kopyası"
 * sayıp indeksten düşürüyordu; JS çalıştırmayan tarayıcılar (Perplexity/Bing/
 * ChatGPT-Search) hepsinde aynı boş kabuğu görüyordu. (Bkz. SEO denetimi K1/K2/Y1.)
 *
 * ÇÖZÜM: Laravel fallback'i index.html'i sunmadan ÖNCE, istenen yol'a (slug) göre
 * title + canonical + description + og/twitter + <noscript> H1'ini bu sınıfla
 * per-route değerlerle değiştirir. Homepage ('/') genelde nginx tarafından statik
 * sunulur (buraya düşmez) ve zaten doğru meta'ya sahiptir; slug META'da yoksa HTML
 * dokunulmadan döner (bugünküyle aynı davranış).
 *
 * NOT: Başlıklar src/App.tsx içindeki SEO_TITLES ile SENKRON tutulmalı (istemci
 * tarafı da aynı değerleri yazar). Yeni rota eklerken iki yeri de güncelle.
 */
final class SeoMeta
{
    /** Geçerli isteğin kanonik kökü (sonunda '/'); varsayılan TavlaTv. Çoklu-domain'de
     *  istek host'una göre inject() tarafından güncellenir. Slug bununla birleşir. */
    private static string $base = 'https://www.tavlatv.com/';

    /** Geçerli isteğin markası (App\Support\Brand::fromHost çıktısı). */
    private static array $brand = [
        'key' => 'tavla', 'name' => 'TavlaTv', 'locale' => 'tr', 'og_locale' => 'tr_TR',
        'origin' => 'https://www.tavlatv.com', 'manifest' => '/manifest.webmanifest', 'og_image' => '/og-image.jpg',
    ];

    /** Varsayılan marka mı (= TavlaTv/Türkçe)? Değilse İngilizce/gammon sunumu uygulanır. */
    private static function isDefaultBrand(): bool
    {
        return (self::$brand['key'] ?? 'tavla') === (string) config('brands.default', 'tavla');
    }

    private static function brandLang(): string
    {
        return (string) (self::$brand['locale'] ?? 'tr');
    }

    /** Verilen marka anahtarının origin kökü (sonunda '/'); hreflang/sitemap çapraz-domain için. */
    private static function originFor(string $key): string
    {
        $o = (string) config("brands.brands.$key.origin", self::$base);

        return rtrim($o, '/').'/';
    }

    private static function brandName(): string
    {
        return (string) (self::$brand['name'] ?? 'TavlaTv');
    }

    // Marka-duyarlı tablo erişimi: varsayılan-dışı markada *_EN varsa onu, yoksa TR'ye düşer.
    private static function metaRow(string $slug): ?array
    {
        if (! self::isDefaultBrand() && isset(self::META_EN[$slug])) {
            return self::META_EN[$slug];
        }

        return self::META[$slug] ?? null;
    }

    private static function landingRow(string $slug): ?array
    {
        if (! self::isDefaultBrand() && isset(self::LANDING_EN[$slug])) {
            return self::LANDING_EN[$slug];
        }

        return self::LANDING[$slug] ?? null;
    }

    private static function guideRow(string $slug): ?array
    {
        if (! self::isDefaultBrand() && isset(self::GUIDES_EN[$slug])) {
            return self::GUIDES_EN[$slug];
        }

        return self::GUIDES[$slug] ?? null;
    }

    private static function makaleRow(string $slug): ?array
    {
        if (! self::isDefaultBrand() && isset(self::MAKALE_META_EN[$slug])) {
            return self::MAKALE_META_EN[$slug];
        }

        return self::MAKALE_META[$slug] ?? null;
    }

    /** Uygulama/hesap ekranları arama sonuçlarına girmemeli. */
    private const NOINDEX = [
        'giris', 'sifremi-unuttum', 'sifre-sifirla',
        'profil', 'profil-duzenle', 'ayarlar', 'tahta-ayarlari',
        'istatistiklerim', 'mac-analizleri', 'hata-gunlugu', 'basarimlar',
        'arkadaslar', 'mesajlar', 'magaza', 'siparislerim', 'sepet', 'odeme',
        'pul-tasarimlari', 'cerceveler', 'oyun-onizleme',
    ];

    /**
     * slug => [title, desc, h1]
     * title: <title> + og:title + twitter:title
     * desc:  meta description + og:description + twitter:description + <noscript> <p>
     * h1:    <noscript> <h1> (JS'siz tarayıcıların gördüğü başlık)
     */
    private const META = [
        'online-tavla' => [
            'Online Tavla Oyna - Ücretsiz Canlı Tavla | TavlaTv',
            'Ücretsiz online tavla oyna! Gerçek rakiplere karşı canlı maçlar, güçlü yapay zekâ botu, turnuvalar ve maç analizi (PR). Kayıt gerektirmez, tarayıcıda hemen başla.',
            'Online Tavla Oyna',
        ],
        'tavla-oyna' => [
            'Tavla Oyna - Ücretsiz Bedava Tavla Oyunu | TavlaTv',
            'Bedava tavla oyna! Ücretsiz, kayıtsız ve tarayıcıda anında açılan tavla oyunu. Yapay zekâya karşı pratik yap, arkadaşınla veya gerçek rakiplerle online tavla oyna.',
            'Tavla Oyna',
        ],
        // İngilizce "backgammon" anahtar kelimesini hedefleyen landing (hreflang tr<->en; eşi /online-tavla).
        'backgammon' => [
            'Play Backgammon Online Free - Live Multiplayer | TavlaTv',
            'Play backgammon online for free. Live matches against real opponents, a strong AI bot, tournaments and move-by-move analysis. No download, no signup — start in your browser.',
            'Play Backgammon Online',
        ],
        'tavla-turnuvasi-organizasyonu' => [
            'Tavla Turnuvası Organizasyonu | Kurumsal, Belediye, AVM | TavlaTv',
            'Kurumlar, belediyeler ve AVM’ler için anahtar teslim tavla turnuvası organizasyonu. Format kurgusu, hakemlik, dijital eşleşme tabloları ve ödül töreni dahil. Teklif alın.',
            'Tavla Turnuvası Organizasyonu',
        ],
        'kurumsal-tavla-turnuvasi' => [
            'Kurumsal Tavla Turnuvası Organizasyonu | TavlaTv',
            'Şirketiniz için kurumsal tavla turnuvası organizasyonu: takım ruhu ve çalışan bağlılığı için anahtar teslim etkinlik. Ofiste, otelde veya hibrit online. Teklif alın.',
            'Kurumsal Tavla Turnuvası',
        ],
        'belediye-tavla-turnuvasi' => [
            'Belediye Tavla Turnuvası Organizasyonu | TavlaTv',
            'Belediyeler için kitlesel katılımlı tavla turnuvası organizasyonu: festival, Ramazan ve kültür etkinlikleri. Dijital kayıt, hakemlik ve ödül töreni dahil. Teklif alın.',
            'Belediye Tavla Turnuvası',
        ],
        'avm-tavla-turnuvasi' => [
            'AVM Tavla Turnuvası Organizasyonu | TavlaTv',
            'AVM’ler için ziyaretçi çeken tavla turnuvası organizasyonu: sahne kurulumu, sponsorluk ve canlı skor ekranları. Marka etkileşimi yaratan etkinlik. Teklif alın.',
            'AVM Tavla Turnuvası',
        ],
        'iletisim' => [
            'İletişim | TavlaTv',
            'TavlaTV ile iletişime geçin: turnuva organizasyonu, sponsorluk, iş birliği ve sorularınız için bize yazın. En kısa sürede size dönüş yapalım.',
            'İletişim',
        ],
        'tek-oyun' => [
            'Tek Oyun Tavla | TavlaTv',
            'Tek başına tavla oyna: yapay zekâya karşı pratik yap, açılışları ve hamleleri dene. Ücretsiz ve kayıt gerektirmez.',
            'Tek Oyun Tavla',
        ],
        'yeni-oyun' => [
            'Online Tavla Maçı Oyna | TavlaTv',
            'Online tavla maçı kur: puanlı (rating) maçlar, farklı zaman kontrolleri ve gerçek rakiplerle canlı tavla.',
            'Online Tavla Maçı Oyna',
        ],
        'arkadasinla-oyna' => [
            'Arkadaşınla Tavla Oyna | TavlaTv',
            'Arkadaşını davet et, birlikte online tavla oyna. Özel maç ayarları, süre ve puan seçenekleriyle.',
            'Arkadaşınla Tavla Oyna',
        ],
        'nasil-oynanir' => [
            'Tavla Nasıl Oynanır? Kurallar ve Rehber | TavlaTv',
            'Tavla nasıl oynanır? Kurallar, açılış dizilimi, zar ve pul hareketleriyle yeni başlayanlar için tavla rehberi.',
            'Tavla Nasıl Oynanır?',
        ],
        'tavla-rehberi' => [
            'Tavla Rehberi — Stratejiler ve İpuçları | TavlaTv',
            'Tavla rehberi: açılış stratejileri, küp (doubling cube) kullanımı, kazanma taktikleri, mars ve backgammon puanlaması. Oyununu geliştirecek özgün yazılar.',
            'Tavla Rehberi',
        ],
        'turnuva-kurallari' => [
            'Tavla Turnuva Kuralları (WBF) — Resmî Kurallar | TavlaTv',
            'WBF (Dünya Tavla Federasyonu) Uluslararası Tavla Turnuva Kuralları: format, süre, zar ve küp kuralları, kural dışı hareketler ve anlaşmazlıkların çözümü. Resmî ve eksiksiz Türkçe kural metni.',
            'Tavla Turnuva Kuralları',
        ],
        'sikca-sorulan-sorular' => [
            'Tavla Hakkında Sıkça Sorulan Sorular | TavlaTv',
            'Tavla kuralları, katlama küpü, maç oyunu, farklı tavla türleri ve TavlaTV rating sistemi hakkında anlaşılır soru-cevaplar.',
            'Tavla Hakkında Sıkça Sorulan Sorular',
        ],
        'sans-carki' => [
            'Şans Çarkı | TavlaTv',
            'Şans Çarkını çevir, ödüller kazan. TavlaTv eğlence oyunlarından Şans Çarkı.',
            'Şans Çarkı',
        ],
        'zar-slotu' => [
            'Zar Slotu | TavlaTv',
            'Zar Slotu: tavla temalı slot oyunu, artan jackpot ve eğlenceli ödüller.',
            'Zar Slotu',
        ],
        'bahane-makinesi' => [
            'Tavla Bahane Makinesi | TavlaTv',
            'Bahane Makinesi: tavla kaybettiğinde işine yarayacak 100 hazır bahane. Salt eğlence.',
            'Tavla Bahane Makinesi',
        ],
        'yz-ile-oyna' => [
            'Yapay Zekâya Karşı Tavla Oyna | TavlaTv',
            'Güçlü yapay zekâ (nöral ağ) tavla botuna karşı ücretsiz online tavla oyna. Seviye seç, hamlelerini analiz et, tavlanı geliştir.',
            'Yapay Zekâya Karşı Tavla Oyna',
        ],
        'online-turnuvalar' => [
            'Online Tavla Turnuvaları | TavlaTv',
            'Online tavla turnuvalarına katıl, ödüller kazan. TavlaTv’de düzenlenen canlı tavla turnuvalarını keşfet.',
            'Online Tavla Turnuvaları',
        ],
        'lider-tablosu' => [
            'Lider Tablosu — En İyi Tavla Oyuncuları | TavlaTv',
            'Türkiye’nin en iyi online tavla oyuncuları ve güncel rating sıralaması. TavlaTv lider tablosunda yerini al.',
            'Tavla Lider Tablosu',
        ],
        'uyelik' => [
            'Üyelik ve Premium | TavlaTv',
            'TavlaTv Premium üyelik: reklamsız oyun, gelişmiş analiz ve ayrıcalıklar. Üyelik seçeneklerini incele.',
            'Üyelik ve Premium',
        ],
        'turnuva-takvimi' => [
            'Tavla Turnuva Takvimi | TavlaTv',
            'Yaklaşan tavla turnuvalarının takvimi. Ulusal ve online tavla etkinliklerini kaçırma.',
            'Tavla Turnuva Takvimi',
        ],
        'kulupler' => [
            'Tavla Kulüpleri | TavlaTv',
            'Tavla kulüplerini keşfet, kulübüne katıl veya kendi tavla kulübünü kur. TavlaTv kulüp rehberi.',
            'Tavla Kulüpleri',
        ],
        'haberler' => [
            'Tavla Haberleri | TavlaTv',
            'Tavla dünyasından son haberler, turnuva sonuçları ve TavlaTv duyuruları.',
            'Tavla Haberleri',
        ],
        'makaleler' => [
            'Tavla Makaleleri | TavlaTv',
            'Tavla stratejileri, taktikleri ve analiz yazıları. Tavlayı daha iyi oynamak için okuyup öğren.',
            'Tavla Makaleleri',
        ],
        'tavla-magazin' => [
            'Tavla Magazin | TavlaTv',
            'Tavla magazin: turnuva röportajları, maç öyküleri ve tavla camiasından haberler.',
            'Tavla Magazin',
        ],
        'pozisyon-analizi' => [
            'Tavla Pozisyon Analizi | TavlaTv',
            'Tavla pozisyon analizi aracı: TavlaTV Motoru ve nöral ağ ile herhangi bir tavla pozisyonunu ücretsiz analiz et.',
            'Tavla Pozisyon Analizi',
        ],
        'mat-analiz' => [
            'Tavla Maç Analizi (.mat) | TavlaTv',
            'Tavla maç analizi: .mat dosyanı yükle, hamle hamle hata oranını (PR) ve en iyi hamleleri gör.',
            'Tavla Maç Analizi (.mat)',
        ],
        'mac-analizleri' => [
            'Maç Analizlerim | TavlaTv',
            'Oynadığın online tavla maçlarının detaylı analizleri, PR ve şans (luck) istatistikleri.',
            'Maç Analizlerim',
        ],
        'hata-gunlugu' => [
            'Hata Günlüğü | TavlaTv',
            'Tavla oyunlarındaki en büyük hatalarını (blunder) takip et ve oyununu geliştir.',
            'Tavla Hata Günlüğü',
        ],
        'bilgi/hakkinda' => [
            'Hakkımızda | TavlaTv',
            'TavlaTv hakkında: Türkiye’nin ücretsiz online tavla platformu. Misyonumuz, özelliklerimiz ve iletişim.',
            'TavlaTv Hakkında',
        ],
        'bilgi/hizmetler' => [
            'Hizmetler | TavlaTv',
            'TavlaTv hizmetleri: online tavla, turnuvalar, analiz araçları ve daha fazlası.',
            'Hizmetlerimiz',
        ],
        'bilgi/sozluk' => [
            'Tavla Sözlüğü — Terimler | TavlaTv',
            'Tavla sözlüğü: tavla terimleri ve anlamları — mars, gammon, backgammon, küp, pip ve daha fazlası.',
            'Tavla Sözlüğü',
        ],
        'bilgi/rutbeler' => [
            'Tavla Rütbeleri | TavlaTv',
            'TavlaTv rütbe sistemi: rating aralıklarına göre tavla ünvanları ve nasıl yükselirsin.',
            'Tavla Rütbeleri',
        ],
        'bilgi/puanlama' => [
            'Puanlama ve PR (Performans) | TavlaTv',
            'Tavla puanlama ve PR (Performance Rating) nasıl hesaplanır? Rating ve hata oranı sistemini öğren.',
            'Puanlama ve PR',
        ],
        'bilgi/basarilarim' => [
            'Rozetler ve Başarımlar | TavlaTv',
            'TavlaTv rozetleri ve başarımları: oyun içi hedefleri tamamla, rozet kazan.',
            'Rozetler ve Başarımlar',
        ],
        'bilgi/adil-zar' => [
            'Adil Zar — Kanıtlanabilir Rastgelelik | TavlaTv',
            'TavlaTv’de zarlar nasıl atılır? Kanıtlanabilir adil (provably fair) rastgelelik ve CSPRNG açıklaması.',
            'Kanıtlanabilir Adil Zar',
        ],
    ];

    /**
     * Tavla Rehberi blog yazıları: slug => [title, desc, h1].
     * Kaynak (tek doğru): src/data/guides.ts — değerler birebir SENKRON tutulmalıdır.
     * /tavla-rehberi/<slug> yolu için per-article meta + BlogPosting JSON-LD enjekte edilir.
     */
    private const LANDING = [
        'online-tavla' => [
            'Online tavla nasıl oynanır?',
            'TavlaTV, tarayıcıdan ücretsiz online tavla oynamanızı sağlar. Gerçek rakiplerle canlı maçlara katılabilir, yapay zekâya karşı pratik yapabilir ve maç performansınızı analiz edebilirsiniz.',
            ['Ücretsiz online tavla maçına katılın.', 'Arkadaşınızla veya yapay zekâ botuyla oynayın.', 'PR, rating ve maç analizleriyle gelişiminizi takip edin.'],
        ],
        'tavla-oyna' => [
            'Ücretsiz tavla oyunu seçenekleri',
            'Kayıt gerektirmeden tarayıcıda tavla oynamaya başlayın. Tek oyun, arkadaşınızla oyun ve canlı rakip seçenekleriyle kendi oyun tarzınıza uygun maçı seçin.',
            ['Tek başınıza yapay zekâya karşı oynayın.', 'Arkadaşınızı davet ederek özel maç oluşturun.', 'Online tavla turnuvalarını ve lider tablosunu keşfedin.'],
        ],
        'backgammon' => [
            'Free online backgammon',
            'TavlaTv lets you play backgammon online free in your browser — against real players worldwide, a neural-network AI, or a friend. Provably fair dice, automatic rules and match analysis.',
            ['Join a free live backgammon match in seconds.', 'Practice against a strong AI bot or invite a friend.', 'Track your progress with rating and performance (PR) analysis.'],
        ],
        'nasil-oynanir' => [
            'Tavla kuralları ve başlangıç rehberi',
            'TavlaTV rehberinde zar kullanımı, pul hareketleri, kırık pul ve toplama kurallarını adım adım öğrenin.',
            ['Tahtanın başlangıç dizilimini öğrenin.', 'Zar ve pul hareketlerinin temel kurallarını inceleyin.', 'Mars ve backgammon puanlamasını öğrenin.'],
        ],
        'tavla-rehberi' => [
            'Tavla strateji rehberi',
            'Açılış hamleleri, kapı ve prime kurma, pip sayımı, doubling cube ve kazanma taktikleri hakkında anlaşılır tavla yazılarını okuyun.',
            ['Tavla açılış stratejilerini inceleyin.', 'Doubling cube kullanımını öğrenin.', 'Mars ve backgammon farklarını keşfedin.'],
        ],
        'online-turnuvalar' => [
            'Online tavla turnuvalarına katılın',
            'TavlaTV online tavla turnuvalarında kayıt, eşleşme, fikstür ve sonuçları tek ekrandan takip edin. Açık turnuvaları ve yaklaşan maçları keşfedin.',
            ['Açık online tavla turnuvalarını inceleyin.', 'Kayıt ve katılım şartlarını kontrol edin.', 'Eşleşmeleri ve turnuva sonuçlarını takip edin.'],
        ],
        'turnuva-takvimi' => [
            'Yaklaşan tavla turnuvaları ve takvim',
            'Tavla turnuvası tarihleri, online ve canlı etkinlikler, kayıt dönemleri ve sonuçları güncel turnuva takviminden takip edin.',
            ['Yaklaşan tavla turnuvalarını tarihe göre bulun.', 'Online ve canlı turnuvaları karşılaştırın.', 'Kayıt tarihlerini ve ödülleri kontrol edin.'],
        ],
        'tavla-turnuvasi-organizasyonu' => [
            'Anahtar teslim tavla turnuvası organizasyonu',
            'TavlaTV; kurum, belediye ve AVM’ler için tavla turnuvası düzenleme, dijital eşleşme, hakemlik ve canlı sonuç yönetimi sunar.',
            ['Format, fikstür ve katılım planını oluşturun.', 'Hakemlik, skor ve eşleşme yönetimini planlayın.', 'Kurumsal etkinlik için teklif alın.'],
        ],
        'kurumsal-tavla-turnuvasi' => [
            'Kurumsal tavla turnuvası organizasyonu',
            'Şirket içi veya şirketler arası tavla turnuvasını çalışan katılımı, takım ruhu ve ölçülebilir sonuçlarla planlayın.',
            ['Ofis, otel veya hibrit etkinlik formatını seçin.', 'Çalışan kayıtlarını ve eşleşmeleri yönetin.', 'Final ve ödül sürecini planlayın.'],
        ],
        'belediye-tavla-turnuvasi' => [
            'Belediye tavla turnuvası organizasyonu',
            'Belediyeler için geniş katılımlı tavla etkinliği: kayıt, fikstür, hakemlik, canlı skor ve ödül töreni süreçlerini tek planla yönetin.',
            ['Mahalle ve ilçe katılımını organize edin.', 'Turnuva kurallarını ve eşleşmeleri duyurun.', 'Sonuçları ve ödülleri şeffaf biçimde yayınlayın.'],
        ],
        'avm-tavla-turnuvasi' => [
            'AVM tavla turnuvası organizasyonu',
            'AVM ziyaretçileri için görünür, eğlenceli ve ölçülebilir tavla turnuvası düzenleyin; sahne, sponsorluk, canlı skor ve final akışını planlayın.',
            ['Ziyaretçi katılımını artıran kayıt akışı kurun.', 'Canlı skor ve eşleşme ekranlarını kullanın.', 'Sponsorluk ve ödül görünürlüğünü planlayın.'],
        ],
        // --- Uygulama/araç sayfaları: benzersiz META vardı ama gövde inceydi (Google "taranan
        // ama indekslenmeyen"). Her birine özgün, taranabilir bir içerik bölümü eklenir. ---
        'tek-oyun' => [
            'Tek kişilik tavla nasıl oynanır?',
            'Tek Oyun modunda rakip beklemeden, kendi hızında tavla oynarsın. Tarayıcıda anında açılır; zar atışları kanıtlanabilir biçimde adildir ve dilediğin an yeni oyuna başlayabilirsin.',
            ['Rakip beklemeden hemen tek başına tavla oyna.', 'Kanıtlanabilir adil zar ve sade arayüz.', 'Yeni öğreniyorsan tavla nasıl oynanır rehberiyle başla.'],
        ],
        'yeni-oyun' => [
            'Online tavla maçı oluştur',
            'Yeni Oyun ile gerçek rakiplere karşı puanlı online tavla maçı başlatırsın. Maç uzunluğunu ve süre kontrolünü seçer, eşleşmeni bulur ve canlı oynarsın; maç sonunda performans reytingini (PR) görürsün.',
            ['Maç uzunluğu ve süre kontrolünü seç.', 'Gerçek rakiplerle puanlı, canlı maç yap.', 'Maç sonunda PR ve rating değişimini gör.'],
        ],
        'yz-ile-oyna' => [
            'Yapay zekâya karşı tavla oyna',
            'Sinir ağı tabanlı güçlü tavla botuna karşı oyna, seviyeni seç ve pratik yap. Bot tamamen tarayıcında çalışır; internet rakibi beklemeden istediğin an antrenman yapabilirsin.',
            ['Zorluk seviyesini kendine göre ayarla.', 'Güçlü sinir ağı botuyla pratik yap.', 'Hamlelerini analiz ederek gelişimini hızlandır.'],
        ],
        'arkadasinla-oyna' => [
            'Arkadaşınla özel tavla maçı',
            'Arkadaşını davet ederek özel bir tavla maçı kurarsın. Maç türünü, uzunluğunu ve süreyi birlikte belirler, davetle rakibini çağırır ve baş başa keyifli bir karşılaşma yaparsınız.',
            ['Arkadaşını davet linki ile çağır.', 'Maç türü, uzunluk ve süreyi birlikte seç.', 'Baş başa puanlı ya da dostluk maçı yap.'],
        ],
        'pozisyon-analizi' => [
            'Tavla pozisyon analizi',
            'Bir tavla pozisyonunu tahtaya dizip en iyi hamleyi ve kazanma olasılığını görürsün. Motor olası hamleleri değerlendirir; küp kararlarını ve equity farklarını inceleyerek oyununu geliştirirsin.',
            ['Pozisyonu tahtaya diz, en iyi hamleyi gör.', 'Kazanma olasılığı ve equity farklarını incele.', 'Küp (double/take/drop) kararlarını değerlendir.'],
        ],
        'mat-analiz' => [
            'MAT dosyası ile tavla maç analizi',
            'Elindeki .mat maç kaydını yükleyerek hamle hamle analiz edersin. Her kararın performans reytingini (PR), hatalı hamleleri ve daha iyi alternatifleri görür, oyununun zayıf noktalarını tespit edersin.',
            ['.mat maç dosyanı yükle, hamle hamle incele.', 'Her kararın PR ve hata payını gör.', 'Daha iyi alternatif hamleleri öğren.'],
        ],
        'uyelik' => [
            'TavlaTV üyeliği ve premium',
            'Ücretsiz üyelikle rating, maç geçmişi ve turnuvalara erişirsin; premium üyelik ise gelişmiş analiz, ekstra kozmetikler ve öncelikli özellikler sunar. Dilediğin zaman yükseltebilir veya iptal edebilirsin.',
            ['Ücretsiz üyelikle rating ve turnuvalara katıl.', 'Premium ile gelişmiş maç analizi ve kozmetikler.', 'Güvenli ödeme; istediğin zaman iptal et.'],
        ],
    ];

    private const GUIDES = [
        'tavla-acilis-stratejileri' => [
            'Tavla Açılış Stratejileri: En İyi İlk Hamleler | TavlaTv',
            'Tavla açılış stratejileri: her zar atışı için en iyi ilk hamleler, 5-nokta ve bar-nokta yapma, blot bırakma riskleri ve yeni başlayanlar için pratik ipuçları.',
            'Tavla Açılış Stratejileri: En İyi İlk Hamleler',
        ],
        'tavla-kupu-doubling-cube' => [
            'Tavla Küpü (Doubling Cube) Nedir, Nasıl Kullanılır? | TavlaTv',
            'Tavla küpü (doubling cube) nedir, nasıl kullanılır? Katlama, kabul (take) ve pas (drop) kararları, Crawford kuralı ve doğru zamanlama ile küp stratejisi rehberi.',
            'Tavla Küpü (Doubling Cube) Nedir, Nasıl Kullanılır?',
        ],
        'tavla-kazanma-taktikleri' => [
            'Tavla Kazanma Taktikleri ve İpuçları | TavlaTv',
            'Tavla kazanma taktikleri: blot bırakmama, kilit ve prime kurma, pip sayımı, yarış ve tutma oyunu ile küp kullanımı. Oyununu geliştirecek pratik ipuçları.',
            'Tavla Kazanma Taktikleri ve İpuçları',
        ],
        'mars-gammon-backgammon-nedir' => [
            'Mars (Gammon) ve Backgammon Nedir? | TavlaTv',
            'Mars (gammon) ve backgammon nedir? Tekli, mars ve backgammon galibiyetlerinin puan değerleri, küp çarpanı ve bu büyük galibiyetleri kazanma/önleme taktikleri.',
            'Mars (Gammon) ve Backgammon Nedir?',
        ],
    ];

    private const MAKALE_META = [
        'tavla-hamle-secme-stratejileri' => ['Tavlada Hamle Seçerken Nelere Bakılır? 3 Temel Strateji | TavlaTV', 'Tavlada kapı almak, taş kırmak ve gerideki taşları çıkarmak için hamle rehberi.'],
        'tavla-nedir' => ['Tavla Nedir? Oyunun Mantığı ve Temel Terimler | TavlaTV', 'Tavla nedir, nasıl kazanılır ve hangi temel terimleri bilmelisiniz? Oyuna yeni başlayanlar için kısa ve anlaşılır bir giriş.'],
        'tavla-nasil-oynanir' => ['Tavla Nasıl Oynanır? Taş Dizilişi, Zar ve Toplama | TavlaTV', 'Tavla kurallarını adım adım öğrenin: 15 taşın dizilişi, zarlarla hareket, taş kırma, bar ve taş toplama.'],
        'tavla-acilis-zarlari-31-42-61-53-65' => ['Tavlada Açılış Zarları: 3–1, 4–2, 6–1, 5–3 ve 6–5 | TavlaTV', 'Tavlada 3–1, 4–2, 6–1, 5–3 ve 6–5 açılış zarları nasıl oynanır? Başlangıç konumunda örnek hamleler ve nedenleri.'],
        'tavla-acilis-zarlari-62-63-64' => ['Tavlada 6–2, 6–3 ve 6–4 Açılışları Nasıl Oynanır? | TavlaTV', '6–2, 6–3 ve 6–4 açılışlarında gerideki taşı çıkarma, kurucu taş getirme ve riskleri değerlendirme rehberi.'],
        'ilk-tavla-turnuvasina-katilim' => ['İlk Tavla Turnuvana Nasıl Katılırsın? Hazırlık Rehberi | TavlaTV', 'İlk tavla turnuvasına katılmadan önce kayıt, kurallar, maç formatı ve oyun günü için pratik hazırlık listesi.'],
        'tavla-turnuvasinda-ilk-gun' => ['Tavla Turnuvasında İlk Gün: Kayıttan Sonuca Adım Adım | TavlaTV', 'Tavla turnuvasında kayıt, eşleşme, maç başlangıcı ve sonuç bildirimi nasıl ilerler? İlk gün için anlaşılır akış.'],
        'evde-tavla-oynama-rehberi' => ['Evde Tavla Oynamak: Ekipman, Format ve Öğrenme Planı | TavlaTV', 'Evde tavla kurmak için gerekenler, maç formatı seçimi ve yeni başlayanların birlikte gelişmesi için öneriler.'],
        'tavlaya-yeni-baslayanlar-rehberi' => ['Tavlaya Yeni Başlayanlar İçin Öğrenme Rehberi | TavlaTV', 'Tavlaya sıfırdan başlamak için kurallar, ilk stratejiler, sık hatalar ve pratik çalışma sırası.'],
    ];

    // ───────────────────────── İngilizce (GammonTV) SEO tabloları ─────────────────────────
    // Varsayılan-dışı marka (gammontv.com) için META/LANDING/GUIDES/MAKALE İngilizce karşılıkları.
    // Eksik slug otomatik TR'ye düşer (metaRow/landingRow/...). AYNI anahtarlar kullanılır (URL
    // slug'ları iki domainde de Türkçe'dir; yalnız sunulan dil değişir).

    /** Ana sayfa (slug '') İngilizce meta: [title, desc, h1]. */
    private const HOME_EN = [
        'GammonTV — Play Backgammon Online Free | Live Multiplayer',
        'Play backgammon online for free. Live matches against real opponents, a strong AI bot, tournaments and move-by-move analysis. No download, no signup — start in your browser.',
        'Play Backgammon Online Free',
    ];

    private const META_EN = [
        'online-tavla' => ['Play Backgammon Online - Free Live Backgammon | GammonTV', 'Play free online backgammon! Live matches against real opponents, a powerful AI bot, tournaments and match analysis (PR). No sign-up required — start right in your browser.', 'Play Backgammon Online'],
        'tavla-oyna' => ['Play Backgammon - Free Online Backgammon Game | GammonTV', 'Play free backgammon! A free, no-registration backgammon game that opens instantly in your browser. Practice against the AI, or play online with a friend or real opponents.', 'Play Backgammon'],
        'backgammon' => ['Play Backgammon Online Free - Live Multiplayer | GammonTV', 'Play backgammon online for free. Live matches against real opponents, a strong AI bot, tournaments and move-by-move analysis. No download, no signup — start in your browser.', 'Play Backgammon Online'],
        'tavla-turnuvasi-organizasyonu' => ['Backgammon Tournament Organization | Corporate, Civic, Retail | GammonTV', 'Turnkey backgammon tournament organization for companies, municipalities and shopping centers. Format design, refereeing, digital pairing boards and an awards ceremony included. Request a quote.', 'Backgammon Tournament Organization'],
        'kurumsal-tavla-turnuvasi' => ['Corporate Backgammon Tournament Organization | GammonTV', 'Corporate backgammon tournament organization for your company: a turnkey event for team spirit and employee engagement. On-site, at a hotel, or hybrid online. Request a quote.', 'Corporate Backgammon Tournament'],
        'belediye-tavla-turnuvasi' => ['Municipal Backgammon Tournament Organization | GammonTV', 'Mass-participation backgammon tournament organization for municipalities: festivals, seasonal and cultural events. Digital registration, refereeing and an awards ceremony included. Request a quote.', 'Municipal Backgammon Tournament'],
        'avm-tavla-turnuvasi' => ['Shopping Mall Backgammon Tournament Organization | GammonTV', 'Footfall-driving backgammon tournament organization for shopping centers: stage setup, sponsorship and live scoreboards. An event that builds brand engagement. Request a quote.', 'Shopping Mall Backgammon Tournament'],
        'iletisim' => ['Contact | GammonTV', 'Get in touch with GammonTV: write to us about tournament organization, sponsorship, partnerships and any questions. We will get back to you as soon as possible.', 'Contact'],
        'tek-oyun' => ['Single-Player Backgammon | GammonTV', 'Play backgammon on your own: practice against the AI and try out openings and moves. Free and no sign-up required.', 'Single-Player Backgammon'],
        'yeni-oyun' => ['Play an Online Backgammon Match | GammonTV', 'Set up an online backgammon match: rated games, different time controls and live backgammon against real opponents.', 'Play an Online Backgammon Match'],
        'arkadasinla-oyna' => ['Play Backgammon With a Friend | GammonTV', 'Invite a friend and play backgammon online together. With custom match settings, time controls and scoring options.', 'Play Backgammon With a Friend'],
        'nasil-oynanir' => ['How to Play Backgammon? Rules and Guide | GammonTV', 'How do you play backgammon? A beginner-friendly guide to the rules, starting setup, and how the dice and checkers move.', 'How to Play Backgammon?'],
        'tavla-rehberi' => ['Backgammon Guide — Strategies and Tips | GammonTV', 'Backgammon guide: opening strategy, using the doubling cube, winning tactics, and gammon and backgammon scoring. Original articles to sharpen your game.', 'Backgammon Guide'],
        'turnuva-kurallari' => ['Backgammon Tournament Rules — Official Rules | GammonTV', 'The international backgammon tournament rules: format, timing, dice and cube rules, illegal moves, and dispute resolution. The complete official rules text.', 'Backgammon Tournament Rules'],
        'sikca-sorulan-sorular' => ['Frequently Asked Questions About Backgammon | GammonTV', 'Clear questions and answers about backgammon rules, the doubling cube, match play, different backgammon variants and the GammonTV rating system.', 'Frequently Asked Questions About Backgammon'],
        'sans-carki' => ['Wheel of Fortune | GammonTV', 'Spin the Wheel of Fortune and win prizes. One of GammonTV\'s fun games.', 'Wheel of Fortune'],
        'zar-slotu' => ['Dice Slot | GammonTV', 'Dice Slot: a backgammon-themed slot game with a growing jackpot and fun prizes.', 'Dice Slot'],
        'bahane-makinesi' => ['Backgammon Excuse Machine | GammonTV', 'Excuse Machine: 100 ready-made excuses for when you lose at backgammon. Just for fun.', 'Backgammon Excuse Machine'],
        'yz-ile-oyna' => ['Play Backgammon Against AI | GammonTV', 'Play free online backgammon against a powerful neural-network AI bot. Choose a level, analyze your moves and improve your game.', 'Play Backgammon Against AI'],
        'online-turnuvalar' => ['Online Backgammon Tournaments | GammonTV', 'Join online backgammon tournaments and win prizes. Explore the live backgammon tournaments hosted on GammonTV.', 'Online Backgammon Tournaments'],
        'lider-tablosu' => ['Leaderboard — Top Backgammon Players | GammonTV', 'The best online backgammon players and the current rating rankings. Claim your spot on the GammonTV leaderboard.', 'Backgammon Leaderboard'],
        'uyelik' => ['Membership and Premium | GammonTV', 'GammonTV Premium membership: ad-free play, advanced analysis and exclusive perks. Explore the membership options.', 'Membership and Premium'],
        'turnuva-takvimi' => ['Backgammon Tournament Calendar | GammonTV', 'A calendar of upcoming backgammon tournaments. Do not miss national and online backgammon events.', 'Backgammon Tournament Calendar'],
        'kulupler' => ['Backgammon Clubs | GammonTV', 'Discover backgammon clubs, join a club or start your own. The GammonTV club directory.', 'Backgammon Clubs'],
        'haberler' => ['Backgammon News | GammonTV', 'The latest news from the backgammon world, tournament results and GammonTV announcements.', 'Backgammon News'],
        'makaleler' => ['Backgammon Articles | GammonTV', 'Backgammon strategy, tactics and analysis articles. Read and learn to play backgammon better.', 'Backgammon Articles'],
        'tavla-magazin' => ['Backgammon Magazine | GammonTV', 'Backgammon magazine: tournament interviews, match stories and news from the backgammon community.', 'Backgammon Magazine'],
        'pozisyon-analizi' => ['Backgammon Position Analysis | GammonTV', 'A backgammon position analysis tool: analyze any backgammon position for free with the GammonTV Engine and neural network.', 'Backgammon Position Analysis'],
        'mat-analiz' => ['Backgammon Match Analysis (.mat) | GammonTV', 'Backgammon match analysis: upload your .mat file and see your error rate (PR) and the best moves, move by move.', 'Backgammon Match Analysis (.mat)'],
        'mac-analizleri' => ['My Match Analyses | GammonTV', 'Detailed analyses of the online backgammon matches you have played, with PR and luck statistics.', 'My Match Analyses'],
        'hata-gunlugu' => ['Error Log | GammonTV', 'Track your biggest blunders in your backgammon games and improve your play.', 'Backgammon Error Log'],
        'bilgi/hakkinda' => ['About Us | GammonTV', 'About GammonTV: a free online backgammon platform. Our mission, our features and how to reach us.', 'About GammonTV'],
        'bilgi/hizmetler' => ['Services | GammonTV', 'GammonTV services: online backgammon, tournaments, analysis tools and more.', 'Our Services'],
        'bilgi/sozluk' => ['Backgammon Glossary — Terms | GammonTV', 'Backgammon glossary: backgammon terms and their meanings — gammon, backgammon, the doubling cube, pip and more.', 'Backgammon Glossary'],
        'bilgi/rutbeler' => ['Backgammon Ranks | GammonTV', 'The GammonTV rank system: backgammon titles by rating range and how you climb them.', 'Backgammon Ranks'],
        'bilgi/puanlama' => ['Scoring and PR (Performance) | GammonTV', 'How are backgammon scoring and PR (performance rating) calculated? Learn how the rating and error-rate system works.', 'Scoring and PR'],
        'bilgi/basarilarim' => ['Badges and Achievements | GammonTV', 'GammonTV badges and achievements: complete in-game goals and earn badges.', 'Badges and Achievements'],
        'bilgi/adil-zar' => ['Fair Dice — Provable Randomness | GammonTV', 'How are the dice rolled on GammonTV? An explanation of provably fair randomness and the CSPRNG behind it.', 'Provably Fair Dice'],
    ];

    private const LANDING_EN = [
        'online-tavla' => ['How do you play backgammon online?', 'GammonTV lets you play backgammon online for free, right from your browser. Join live matches against real opponents, practice against the AI, and analyze your match performance.', ['Join a free online backgammon match.', 'Play against a friend or the AI bot.', 'Track your progress with PR, rating and match analysis.']],
        'tavla-oyna' => ['Free backgammon game options', 'Start playing backgammon in your browser with no sign-up required. Choose the match that suits your style — single-player, play with a friend, or a live opponent.', ['Play solo against the AI.', 'Invite a friend to create a private match.', 'Explore online backgammon tournaments and the leaderboard.']],
        'backgammon' => ['Free online backgammon', 'GammonTV lets you play backgammon online free in your browser — against real players worldwide, a neural-network AI, or a friend. Provably fair dice, automatic rules and match analysis.', ['Join a free live backgammon match in seconds.', 'Practice against a strong AI bot or invite a friend.', 'Track your progress with rating and performance (PR) analysis.']],
        'nasil-oynanir' => ['Backgammon rules and getting-started guide', 'In the GammonTV guide, learn how to use the dice, move your checkers, and handle hits and bearing off, step by step.', ['Learn the board\'s starting setup.', 'Review the basic rules for dice and checker movement.', 'Learn gammon and backgammon scoring.']],
        'tavla-rehberi' => ['Backgammon strategy guide', 'Read clear backgammon articles on opening moves, building points and primes, pip counting, the doubling cube, and winning tactics.', ['Explore backgammon opening strategy.', 'Learn how to use the doubling cube.', 'Discover the difference between a gammon and a backgammon.']],
        'online-turnuvalar' => ['Join online backgammon tournaments', 'Follow registration, pairings, brackets and results on a single screen in GammonTV online backgammon tournaments. Explore open tournaments and upcoming matches.', ['Browse open online backgammon tournaments.', 'Check the registration and entry requirements.', 'Follow the pairings and tournament results.']],
        'turnuva-takvimi' => ['Upcoming backgammon tournaments and calendar', 'Follow backgammon tournament dates, online and live events, registration windows and results in the up-to-date tournament calendar.', ['Find upcoming backgammon tournaments by date.', 'Compare online and live tournaments.', 'Check registration dates and prizes.']],
        'tavla-turnuvasi-organizasyonu' => ['Turnkey backgammon tournament organization', 'GammonTV provides backgammon tournament hosting, digital pairings, refereeing and live result management for companies, municipalities and shopping centers.', ['Design the format, bracket and participation plan.', 'Plan refereeing, scoring and pairing management.', 'Request a quote for your corporate event.']],
        'kurumsal-tavla-turnuvasi' => ['Corporate backgammon tournament organization', 'Plan an in-house or inter-company backgammon tournament with employee participation, team spirit and measurable results.', ['Choose an office, hotel or hybrid event format.', 'Manage employee registrations and pairings.', 'Plan the final and the awards process.']],
        'belediye-tavla-turnuvasi' => ['Municipal backgammon tournament organization', 'A large-turnout backgammon event for municipalities: manage registration, brackets, refereeing, live scoring and the awards ceremony in a single plan.', ['Organize neighborhood and district participation.', 'Announce the tournament rules and pairings.', 'Publish results and prizes transparently.']],
        'avm-tavla-turnuvasi' => ['Shopping mall backgammon tournament organization', 'Run a visible, fun and measurable backgammon tournament for shopping-center visitors; plan the stage, sponsorship, live scoring and final flow.', ['Set up a registration flow that boosts visitor turnout.', 'Use live scoring and pairing displays.', 'Plan sponsorship and prize visibility.']],
        'tek-oyun' => ['How do you play single-player backgammon?', 'In Single-Player mode you play backgammon at your own pace, with no waiting for an opponent. It opens instantly in your browser, the dice rolls are provably fair, and you can start a new game whenever you like.', ['Play backgammon solo right away, no opponent needed.', 'Provably fair dice and a clean interface.', 'New to the game? Start with the how-to-play guide.']],
        'yeni-oyun' => ['Create an online backgammon match', 'With New Game you start a rated online backgammon match against real opponents. Choose the match length and time control, find your pairing and play live; at the end you see your performance rating (PR).', ['Choose the match length and time control.', 'Play rated, live matches against real opponents.', 'See your PR and rating change at the end of the match.']],
        'yz-ile-oyna' => ['Play backgammon against AI', 'Play against a powerful neural-network backgammon bot, choose your level and practice. The bot runs entirely in your browser, so you can train whenever you like with no need to wait for an online opponent.', ['Set the difficulty level to match your own.', 'Practice against a powerful neural-network bot.', 'Speed up your progress by analyzing your moves.']],
        'arkadasinla-oyna' => ['A private backgammon match with a friend', 'Invite a friend to set up a private backgammon match. Decide the match type, length and time control together, call your opponent in with an invite, and enjoy a head-to-head game.', ['Call your friend in with an invite link.', 'Choose the match type, length and time together.', 'Play a rated or friendly head-to-head match.']],
        'pozisyon-analizi' => ['Backgammon position analysis', 'Set up a backgammon position on the board and see the best move and its winning chances. The engine evaluates the possible moves; sharpen your game by reviewing cube decisions and equity differences.', ['Set up the position on the board and see the best move.', 'Review winning chances and equity differences.', 'Evaluate cube decisions (double/take/drop).']],
        'mat-analiz' => ['Backgammon match analysis with a MAT file', 'Upload your .mat match record to analyze it move by move. See the performance rating (PR) of each decision, the mistaken moves and the better alternatives, and pinpoint the weak spots in your game.', ['Upload your .mat match file and review it move by move.', 'See the PR and error margin of each decision.', 'Learn the better alternative moves.']],
        'uyelik' => ['GammonTV membership and premium', 'A free membership gives you access to rating, match history and tournaments; premium membership adds advanced analysis, extra cosmetics and priority features. You can upgrade or cancel anytime.', ['Join rating and tournaments with a free membership.', 'Advanced match analysis and cosmetics with premium.', 'Secure payment; cancel anytime.']],
    ];

    private const GUIDES_EN = [
        'tavla-acilis-stratejileri' => ['Backgammon Opening Strategy: The Best First Moves | GammonTV', 'Backgammon opening strategy: the best first move for every roll, making the 5-point and the bar-point, the risks of leaving a blot, and practical tips for beginners.', 'Backgammon Opening Strategy: The Best First Moves'],
        'tavla-kupu-doubling-cube' => ['What Is the Doubling Cube and How Do You Use It? | GammonTV', 'What is the backgammon doubling cube and how do you use it? A strategy guide to doubling, take and drop decisions, the Crawford rule, and getting the timing right.', 'What Is the Doubling Cube and How Do You Use It?'],
        'tavla-kazanma-taktikleri' => ['Backgammon Winning Tactics and Tips | GammonTV', 'Backgammon winning tactics: avoiding blots, building blocks and primes, pip counting, racing and holding games, and using the doubling cube. Practical tips to improve your game.', 'Backgammon Winning Tactics and Tips'],
        'mars-gammon-backgammon-nedir' => ['What Are a Gammon and a Backgammon? | GammonTV', 'What are a gammon and a backgammon? The point values of single, gammon and backgammon wins, the cube multiplier, and tactics for winning or preventing these big wins.', 'What Are a Gammon and a Backgammon?'],
    ];

    private const MAKALE_META_EN = [
        'tavla-hamle-secme-stratejileri' => ['How to Choose Your Move in Backgammon: 3 Core Strategies | GammonTV', 'A move-selection guide for making points, hitting checkers and escaping your back checkers in backgammon.'],
        'tavla-nedir' => ['What Is Backgammon? The Logic of the Game and Key Terms | GammonTV', 'What is backgammon, how do you win, and which basic terms should you know? A short, clear introduction for newcomers to the game.'],
        'tavla-nasil-oynanir' => ['How to Play Backgammon? Checker Setup, Dice and Bearing Off | GammonTV', 'Learn the rules of backgammon step by step: the setup of 15 checkers, moving with the dice, hitting, the bar, and bearing off.'],
        'tavla-acilis-zarlari-31-42-61-53-65' => ['Backgammon Opening Rolls: 3-1, 4-2, 6-1, 5-3 and 6-5 | GammonTV', 'How do you play the 3-1, 4-2, 6-1, 5-3 and 6-5 opening rolls in backgammon? Example moves from the starting position and the reasoning behind them.'],
        'tavla-acilis-zarlari-62-63-64' => ['How Do You Play the 6-2, 6-3 and 6-4 Openings in Backgammon? | GammonTV', 'A guide to escaping a back checker, bringing down a builder and weighing the risks on the 6-2, 6-3 and 6-4 openings.'],
        'ilk-tavla-turnuvasina-katilim' => ['How Do You Enter Your First Backgammon Tournament? A Prep Guide | GammonTV', 'Before entering your first backgammon tournament: a practical checklist for registration, rules, match format and game day.'],
        'tavla-turnuvasinda-ilk-gun' => ['Your First Day at a Backgammon Tournament: From Check-In to Result | GammonTV', 'How do check-in, pairings, the start of a match and reporting the result unfold at a backgammon tournament? A clear walkthrough for day one.'],
        'evde-tavla-oynama-rehberi' => ['Playing Backgammon at Home: Gear, Format and a Learning Plan | GammonTV', 'What you need to set up backgammon at home, choosing a match format, and tips for beginners to improve together.'],
        'tavlaya-yeni-baslayanlar-rehberi' => ['A Learning Guide for Backgammon Beginners | GammonTV', 'Starting backgammon from scratch: the rules, first strategies, common mistakes, and the order to practice in.'],
    ];

    /** Tarihler içerik dosyasının Git geçmişindeki ilk yayın commit'inden alınmıştır. */
    private const GUIDE_DATES = [
        'tavla-acilis-stratejileri' => ['2026-09-22T18:24:48+03:00', '2026-09-22T18:24:48+03:00'],
        'tavla-kupu-doubling-cube' => ['2026-09-22T18:24:48+03:00', '2026-09-22T18:24:48+03:00'],
        'tavla-kazanma-taktikleri' => ['2026-09-22T18:24:48+03:00', '2026-09-22T18:24:48+03:00'],
        'mars-gammon-backgammon-nedir' => ['2026-09-22T18:24:48+03:00', '2026-09-22T18:24:48+03:00'],
    ];

    /**
     * Arama motorlarına AÇIK (indekslenmesi istenen) tüm statik rotaların MUTLAK URL listesi.
     * Tek kaynak: SEO META'sı tanımlı rotalar (NOINDEX hariç) + Tavla Rehberi kılavuzları.
     * seo:sitemap komutu bunu sitemap.xml ile karşılaştırıp EKSİK olanları otomatik ekler
     * (yeni sayfa eklenince sitemap'in elle güncellenmesi UNUTULSA bile kapanır). NOINDEX
     * (giriş/profil/sepet/ödeme… hesap ekranları) DIŞARIDA bırakılır.
     *
     * @return list<string>
     */
    public static function indexableUrls(?string $brandKey = null): array
    {
        // Çoklu-domain sitemap: her marka kendi origin'iyle listelenir. brandKey verilmezse
        // DETERMİNİSTİK varsayılan marka (self::$base mutable static'e GÜVENME — önceki isteğin
        // host'u sızabilir; FPM'de fresh ama test sürecinde kalıcıdır).
        $base = self::originFor($brandKey ?? (string) config('brands.default', 'tavla'));

        $urls = [];
        foreach (array_keys(self::META) as $slug) {
            if (in_array($slug, self::NOINDEX, true)) {
                continue;
            }
            $urls[] = $base.$slug;
        }
        foreach (array_keys(self::GUIDES) as $slug) {
            $urls[] = $base.'tavla-rehberi/'.$slug;
        }

        return array_values(array_unique($urls));
    }

    /**
     * Host-duyarlı sitemap XML'i (gammontv.com .htaccess ile /sitemap.xml'i Laravel'e yönlendirir;
     * tavlatv.com curated statik sitemap.xml'i kullanır — seo:sitemap komutu). Statik indekslenebilir
     * rotalar + yayındaki haber slug'ları, markanın origin'iyle listelenir.
     */
    public static function sitemapXml(string $brandKey): string
    {
        $base = self::originFor($brandKey);
        $urls = self::indexableUrls($brandKey);
        try {
            $rows = \App\Models\Content::query()
                ->where('type', 'news')->where('published', true)
                ->orderByDesc('updated_at')->get(['title']);
            $seen = [];
            foreach ($rows as $row) {
                $slug = self::sitemapSlug((string) $row->title);
                if ($slug === '' || isset($seen[$slug])) {
                    continue;
                }
                $seen[$slug] = true;
                $urls[] = $base.'haberler/'.$slug;
            }
        } catch (\Throwable) {
            // DB erişilemezse yalnız statik URL'ler.
        }

        $items = '';
        foreach (array_values(array_unique($urls)) as $u) {
            $items .= "  <url>\n    <loc>".htmlspecialchars($u, ENT_XML1, 'UTF-8')."</loc>\n  </url>\n";
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n"
            .$items
            .'</urlset>'."\n";
    }

    private static function sitemapSlug(string $value): string
    {
        $value = strtr($value, [
            'ç' => 'c', 'ğ' => 'g', 'ı' => 'i', 'ö' => 'o', 'ş' => 's', 'ü' => 'u',
            'İ' => 'i', 'Ç' => 'c', 'Ğ' => 'g', 'Ö' => 'o', 'Ş' => 's', 'Ü' => 'u',
        ]);
        $value = mb_strtolower($value, 'UTF-8');
        $value = preg_replace('/[^a-z0-9]+/', '-', $value);

        return trim((string) $value, '-');
    }

    /**
     * index.html içeriğini, istenen yola göre per-route SEO etiketleriyle döndür.
     * Slug ne statik META'da ne de dinamik haber olarak eşleşirse içerik DEĞİŞMEDEN
     * döner (homepage/bilinmeyen = mevcut davranış).
     */
    public static function inject(string $path, string $html, ?string $host = null): string
    {
        // Çoklu-domain: istek host'u markayı (dil + kanonik kök) belirler.
        self::$brand = Brand::fromHost($host);
        self::$base = Brand::base(self::$brand);

        $slug = trim($path, '/');
        $html = self::injectRoute($slug, $html);

        // Varsayılan dışı marka (GammonTV/İngilizce): statik TR index.html kabuğunu global
        // olarak markala (dil, marka adı, og:locale, manifest, temel @graph).
        if (! self::isDefaultBrand()) {
            if ($slug === '') {
                // Ana sayfa: TR başlık/açıklama yerine İngilizce ana sayfa meta'sı.
                [$ht, $hd, $hh] = self::HOME_EN;
                $html = self::apply($html, $ht, $hd, $hh, self::$base, null, 'website', null);
            }
            $html = self::applyBrand($html);
        }

        return self::injectCrossDomainHreflang($html, $slug);
    }

    /**
     * Yola göre per-route SEO etiketleri. self::$base / self::$brand inject() tarafından
     * set edilir; varsayılan-dışı markada *_EN tabloları kullanılır (yoksa TR'ye düşer).
     */
    private static function injectRoute(string $slug, string $html): string
    {
        if ($slug === '') {
            return $html;
        }

        if (in_array($slug, self::NOINDEX, true)) {
            return self::applyNoIndex($html);
        }

        // 1a) /backgammon: TavlaTv alan adındaki İngilizce landing (eski same-domain hreflang çifti).
        if ($slug === 'backgammon' && ($row = self::metaRow($slug)) !== null) {
            [$title, $desc, $h1] = $row;
            $url = self::$base . $slug;
            $html = self::apply($html, $title, $desc, $h1, $url, null, 'website', self::landingRow($slug));
            $html = self::applyEnglishLocale($html);
            $html = self::injectHreflang($html);
            $html = self::injectVideoGameJsonLd($html, $h1, $desc, $url, 'en');
            $html = self::injectWebPageJsonLd($html, $h1, $desc, $url, 'en');

            return self::injectBreadcrumbJsonLd($html, [[$h1, $url]], 'Home');
        }

        // 1) Statik rota META tablosu.
        if (($row = self::metaRow($slug)) !== null) {
            [$title, $desc, $h1] = $row;

            $html = self::apply($html, $title, $desc, $h1, self::$base . $slug, null, 'website', self::landingRow($slug));

            $html = self::injectWebPageJsonLd($html, $h1, $desc, self::$base . $slug, self::brandLang());
            if ($slug === 'tavla-oyna') {
                $html = self::injectVideoGameJsonLd($html, $h1, $desc, self::$base . $slug, self::brandLang());
            }
            // /online-tavla = /backgammon'un Türkçe eşi: karşılıklı hreflang (reciprocal şart).
            if ($slug === 'online-tavla') {
                $html = self::injectHreflang($html);
            }

            // Statik landing/bilgi sayfaları: Ana Sayfa › <sayfa> (2 seviye).
            return self::injectBreadcrumbJsonLd($html, [[$h1, self::$base . $slug]]);
        }

        // 2) Dinamik haber makalesi: /haberler/<slug>. Paylaşımda (WhatsApp/Twitter vb.)
        //    makalenin kendi başlığı + özeti + KAPAK GÖRSELİ görünsün diye per-article
        //    og/twitter etiketlerini enjekte et. Slug, frontend slugify(title) ile aynı.
        $parts = explode('/', $slug);

        // 2b) Tavla Rehberi yazısı: /tavla-rehberi/<slug>. Per-article title/desc/h1 +
        //     BlogPosting JSON-LD (yalnız gerçek/doğru alanlarla). guides.ts ile senkron.
        if (count($parts) === 2 && $parts[0] === 'tavla-rehberi' && ($g = self::guideRow($parts[1])) !== null) {
            [$title, $desc, $h1] = $g;
            $url = self::$base . $slug;
            $html = self::apply($html, $title, $desc, $h1, $url, null, 'article');

            [$datePublished, $dateModified] = self::GUIDE_DATES[$parts[1]];
            $html = self::injectJsonLd($html, $h1, $desc, $url, $datePublished, $dateModified);

            // Ana Sayfa › Tavla Rehberi › <yazı> (görünür Breadcrumb ile aynı).
            return self::injectBreadcrumbJsonLd($html, [
                ['Tavla Rehberi', self::$base . 'tavla-rehberi'],
                [$h1, $url],
            ]);
        }

        // 2c) Makale: /makaleler/<slug>. İçerik Content(type=makale)'den gelir.
        if (count($parts) === 2 && $parts[0] === 'makaleler') {
            $article = self::findMakale($parts[1]);
            if ($article) {
                [$title, $desc] = self::makaleRow($parts[1])
                    ?? [(string) $article->title . ' | ' . self::brandName(), self::excerpt($article->body) ?: 'Tavla stratejileri, taktikleri ve analiz yazıları.'];
                $image = self::ogVariant($article->image) ?: self::absImg($article->image) ?: self::$base . 'og-image.jpg';
                $url = self::$base . $slug;

                $html = self::apply($html, $title, $desc, (string) $article->title, $url, $image, 'article');
                $html = self::injectArticleJsonLd(
                    $html,
                    (string) $article->title,
                    $desc,
                    $url,
                    $image,
                    $article->event_at,
                    $article->updated_at,
                );

                // Ana Sayfa › Makaleler › <başlık> (görünür Breadcrumb ile aynı).
                return self::injectBreadcrumbJsonLd($html, [
                    ['Makaleler', self::$base . 'makaleler'],
                    [(string) $article->title, $url],
                ]);
            }

            return self::applyNoIndex($html);
        }

        if (count($parts) === 2 && $parts[0] === 'haberler') {
            $article = self::findNews($parts[1]);
            if ($article) {
                $title = $article->title . ' | TavlaTv';
                $desc  = self::excerpt($article->body)
                    ?: 'Tavla dünyasından son haberler, turnuva sonuçları ve TavlaTv duyuruları.';
                $image = self::ogVariant($article->image) ?: self::absImg($article->image) ?: self::$base . 'og-image.jpg';

                $html = self::apply(
                    $html,
                    $title,
                    $desc,
                    (string) $article->title,
                    self::$base . $slug,
                    $image,
                    'article',
                );

                $html = self::injectArticleJsonLd(
                    $html,
                    (string) $article->title,
                    $desc,
                    self::$base . $slug,
                    $image,
                    $article->event_at,
                    $article->updated_at,
                );

                // Ana Sayfa › Haberler › <başlık> (görünür Breadcrumb ile aynı).
                return self::injectBreadcrumbJsonLd($html, [
                    ['Haberler', self::$base . 'haberler'],
                    [(string) $article->title, self::$base . $slug],
                ]);
            }

            // Bilinmeyen/özel haber slug'ı SPA kabuğu olarak dönse bile indekslenmesin.
            return self::applyNoIndex($html);
        }

        if (count($parts) === 2 && $parts[0] === 'tavla-rehberi') {
            return self::applyNoIndex($html);
        }

        return $html;
    }

    /** Fallback route'unun dinamik içerik için 404 status seçmesine yardımcı olur. */
    public static function knownDynamicPath(string $path): bool
    {
        $parts = explode('/', trim($path, '/'));
        if (count($parts) !== 2) {
            return true;
        }
        if ($parts[0] === 'tavla-rehberi') {
            return isset(self::GUIDES[$parts[1]]);
        }
        if ($parts[0] === 'haberler') {
            return self::findNews($parts[1]) !== null;
        }
        if ($parts[0] === 'makaleler') {
            return self::findMakale($parts[1]) !== null;
        }

        return true;
    }

    /** Authenticated/app-only screens remain crawlable routes for the SPA but not indexable. */
    private static function applyNoIndex(string $html): string
    {
        $replacement = '<meta name="robots" content="noindex, follow" />';
        $out = preg_replace_callback(
            '~<meta\s+name="robots"\s+content="[^"]*"\s*/?>~i',
            static fn () => $replacement,
            $html,
            1,
        );
        if ($out !== null && $out !== $html) {
            return $out;
        }

        $out = preg_replace_callback('~</head>~i', static fn () => $replacement . '</head>', $html, 1);

        return $out ?? $html;
    }

    /**
     * Verilen değerlerle <head> etiketlerini değiştirir. $image verilirse og:image /
     * og:image:alt / twitter:image de güncellenir. preg_replace_callback kullanılır:
     * replacement string'i olduğu gibi basar (kullanıcı içeriğindeki "$1"/"\" gibi
     * dizeler geri-referans sanılıp bozulmaz).
     */
    private static function apply(
        string $html,
        string $title,
        string $desc,
        string $h1,
        string $url,
        ?string $image,
        string $type,
        ?array $landing = null,
    ): string {
        $tTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $tDesc  = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
        $tH1    = htmlspecialchars($h1, ENT_QUOTES, 'UTF-8');
        $tUrl   = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');

        // Her biri: etiket varsa değiştir, yoksa no-op. /s -> çok-satırlı <meta> (description,
        // og:description) de yakalanır. content="[^"]*" -> tek çift-tırnaklı değer.
        $subs = [
            '~<title>.*?</title>~s' => "<title>{$tTitle}</title>",
            '~<link\s+rel="canonical"[^>]*>~s' => "<link rel=\"canonical\" href=\"{$tUrl}\" />",
            '~<meta\s+name="description"\s+content="[^"]*"\s*/?>~s' => "<meta name=\"description\" content=\"{$tDesc}\" />",
            '~<meta\s+property="og:title"\s+content="[^"]*"\s*/?>~s' => "<meta property=\"og:title\" content=\"{$tTitle}\" />",
            '~<meta\s+property="og:description"\s+content="[^"]*"\s*/?>~s' => "<meta property=\"og:description\" content=\"{$tDesc}\" />",
            '~<meta\s+property="og:url"\s+content="[^"]*"\s*/?>~s' => "<meta property=\"og:url\" content=\"{$tUrl}\" />",
            '~<meta\s+property="og:type"\s+content="[^"]*"\s*/?>~s' => "<meta property=\"og:type\" content=\"{$type}\" />",
            '~<meta\s+name="twitter:title"\s+content="[^"]*"\s*/?>~s' => "<meta name=\"twitter:title\" content=\"{$tTitle}\" />",
            '~<meta\s+name="twitter:description"\s+content="[^"]*"\s*/?>~s' => "<meta name=\"twitter:description\" content=\"{$tDesc}\" />",
            // JS'siz tarayıcıların gördüğü H1 + açıklama: per-route yap.
            '~<noscript>.*?</noscript>~s' => self::renderNoscript($tH1, $tDesc, $landing),
        ];

        if ($image) {
            $tImg = htmlspecialchars($image, ENT_QUOTES, 'UTF-8');
            // og:image:type MIME uzantidan turetilir (WhatsApp/strict crawler bunu bekler).
            $ext = strtolower((string) pathinfo((string) (parse_url($image, PHP_URL_PATH) ?: $image), PATHINFO_EXTENSION));
            $mime = $ext === 'png' ? 'image/png' : ($ext === 'webp' ? 'image/webp' : 'image/jpeg');
            $subs['~<meta\s+property="og:image"\s+content="[^"]*"\s*/?>~s'] = "<meta property=\"og:image\" content=\"{$tImg}\" />";
            $subs['~<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*/?>~s'] = "<meta property=\"og:image:secure_url\" content=\"{$tImg}\" />";
            $subs['~<meta\s+property="og:image:type"\s+content="[^"]*"\s*/?>~s'] = "<meta property=\"og:image:type\" content=\"{$mime}\" />";
            $subs['~<meta\s+property="og:image:alt"\s+content="[^"]*"\s*/?>~s'] = "<meta property=\"og:image:alt\" content=\"{$tTitle}\" />";
            $subs['~<meta\s+name="twitter:image"\s+content="[^"]*"\s*/?>~s'] = "<meta name=\"twitter:image\" content=\"{$tImg}\" />";
        }

        foreach ($subs as $pattern => $replacement) {
            $out = preg_replace_callback($pattern, fn () => $replacement, $html, 1);
            if ($out !== null) {
                $html = $out; // preg hatasında (null) o adımı atla, HTML'i bozma
            }
        }

        return $html;
    }

    /** İngilizce landing: <html lang> ve og:locale'i İngilizceye çevirir (dil sinyali). */
    private static function applyEnglishLocale(string $html): string
    {
        $out = preg_replace('~<html\s+lang="[^"]*"~i', '<html lang="en"', $html, 1);
        $html = $out ?? $html;
        $out = preg_replace('~<meta\s+property="og:locale"\s+content="[^"]*"\s*/?>~i', '<meta property="og:locale" content="en_US" />', $html, 1);

        return $out ?? $html;
    }

    /**
     * tr<->en hreflang kümesi (+x-default). Küme üyeleri AYNI etiketleri taşır (her sayfa tüm
     * alternatifleri + kendini listeler) -> /online-tavla ve /backgammon'a BİREBİR aynısı basılır
     * (reciprocal = geçerli). Kümeyi büyütürken tek yer burası.
     */
    private static function injectHreflang(string $html): string
    {
        $tags = '<link rel="alternate" hreflang="tr" href="' . self::originFor('tavla') . 'online-tavla" />'
            . '<link rel="alternate" hreflang="en" href="' . self::originFor('tavla') . 'backgammon" />'
            . '<link rel="alternate" hreflang="x-default" href="' . self::originFor('tavla') . 'online-tavla" />';
        $out = preg_replace_callback('~</head>~i', static fn () => $tags . '</head>', $html, 1);

        return $out ?? $html;
    }

    /**
     * Varsayılan-dışı marka (GammonTV/İngilizce) global dönüşümü: statik TR index.html
     * kabuğunu host + marka adı + dil + manifest + temel @graph bakımından markalar.
     * Yalnız isDefaultBrand() == false iken çağrılır (TavlaTv byte-aynı kalır).
     */
    private static function applyBrand(string $html): string
    {
        $b = self::$brand;

        // 1) Host değişimi: statik index.html'deki tüm mutlak tavlatv URL'leri -> marka host'u
        //    (canonical/og:url/og:image/JSON-LD @id/url/logo). Per-route etiketler zaten marka
        //    base'iyle yazıldığından etkilenmez.
        $defaultKey = (string) config('brands.default', 'tavla');
        $defaultHost = (string) parse_url((string) config("brands.brands.$defaultKey.origin", 'https://www.tavlatv.com'), PHP_URL_HOST);
        $brandHost = (string) parse_url((string) ($b['origin'] ?? ''), PHP_URL_HOST);
        if ($defaultHost !== '' && $brandHost !== '' && $defaultHost !== $brandHost) {
            $html = str_replace($defaultHost, $brandHost, $html);
        }

        // 2) Marka adı: SADECE belirli meta etiketlerinde (og:site_name, author, apple-title).
        //    DİKKAT: global str_replace YAPMA — "/assets/TavlaTvLogo-*.js" modulepreload yolunu
        //    bozar ve JS yüklenmez. JSON-LD adları (4) temel @graph yeniden kurularak düzelir;
        //    noscript marka metni renderNoscript içinde dile göre üretilir.
        $name = htmlspecialchars((string) ($b['name'] ?? 'TavlaTv'), ENT_QUOTES, 'UTF-8');
        $html = preg_replace_callback('~<meta\s+property="og:site_name"\s+content="[^"]*"\s*/?>~i', static fn () => '<meta property="og:site_name" content="' . $name . '" />', $html, 1) ?? $html;
        $html = preg_replace_callback('~<meta\s+name="author"\s+content="[^"]*"\s*/?>~i', static fn () => '<meta name="author" content="' . $name . '" />', $html, 1) ?? $html;
        $html = preg_replace_callback('~<meta\s+name="apple-mobile-web-app-title"\s+content="[^"]*"\s*/?>~i', static fn () => '<meta name="apple-mobile-web-app-title" content="' . $name . '" />', $html, 1) ?? $html;

        // 3) <html lang>, og:locale, manifest href
        $lang = self::brandLang();
        $ogLocale = (string) ($b['og_locale'] ?? 'tr_TR');
        $manifest = (string) ($b['manifest'] ?? '/manifest.webmanifest');
        $html = preg_replace_callback('~<html\s+lang="[^"]*"~i', static fn () => '<html lang="' . $lang . '"', $html, 1) ?? $html;
        $html = preg_replace_callback('~<meta\s+property="og:locale"\s+content="[^"]*"\s*/?>~i', static fn () => '<meta property="og:locale" content="' . $ogLocale . '" />', $html, 1) ?? $html;
        $html = preg_replace_callback('~<link\s+rel="manifest"\s+href="[^"]*"\s*/?>~i', static fn () => '<link rel="manifest" href="' . $manifest . '" />', $html, 1) ?? $html;

        // 4) Temel @graph'ı İngilizce/marka sürümüyle değiştir (statik index'teki ilk ld+json).
        $graph = self::brandBaseJsonLd();
        $html = preg_replace_callback(
            '~<script type="application/ld\+json">(?:(?!</script>).)*?"@graph"(?:(?!</script>).)*?</script>~s',
            static fn () => $graph,
            $html,
            1,
        ) ?? $html;

        return $html;
    }

    /**
     * Varsayılan-dışı marka için temel @graph (Organization + WebSite + VideoGame), İngilizce.
     * ponytail: İngilizce kopya gömülü — tek varsayılan-dışı marka (gammon/en) olduğu sürece yeterli;
     * 3. bir dil eklenirse markaya göre parametrele.
     */
    private static function brandBaseJsonLd(): string
    {
        $base = self::$base;
        $name = self::brandName();
        $lang = self::brandLang();
        $img = $base . ltrim((string) (self::$brand['og_image'] ?? '/og-image.jpg'), '/');
        $graph = [
            '@context' => 'https://schema.org',
            '@graph' => [
                [
                    '@type' => 'Organization',
                    '@id' => $base . '#organization',
                    'name' => $name,
                    'url' => $base,
                    'logo' => $base . 'icon-512.png',
                    'image' => $img,
                ],
                [
                    '@type' => 'WebSite',
                    '@id' => $base . '#website',
                    'name' => $name,
                    'alternateName' => 'Online Backgammon',
                    'url' => $base,
                    'publisher' => ['@id' => $base . '#organization'],
                    'inLanguage' => $lang,
                ],
                [
                    '@type' => 'VideoGame',
                    'name' => $name . ' — Free Online Backgammon',
                    'url' => $base,
                    'description' => 'Play backgammon online for free: live matches against real players, a strong AI bot, tournaments and move-by-move analysis.',
                    'inLanguage' => $lang,
                    'genre' => ['Backgammon', 'Board Game'],
                    'applicationCategory' => 'Game',
                    'operatingSystem' => 'Web',
                    'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD'],
                ],
            ],
        ];
        $json = json_encode($graph, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return '<script type="application/ld+json">' . ($json !== false ? $json : '{}') . '</script>';
    }

    /**
     * Çapraz-domain hreflang (tr=tavlatv/slug, en=gammontv/slug, x-default=tr). Ana sayfa + statik
     * indekslenebilir META rotaları için. /online-tavla ve /backgammon eski same-domain çiftini
     * korur (injectHreflang) — burada atlanır. Dinamik haber/makale sonraki iyileştirme (yalnız
     * self-canonical taşır).
     */
    private static function injectCrossDomainHreflang(string $html, string $slug): string
    {
        if (in_array($slug, ['online-tavla', 'backgammon'], true)) {
            return $html;
        }
        $indexable = $slug === '' || (isset(self::META[$slug]) && ! in_array($slug, self::NOINDEX, true));
        if (! $indexable) {
            return $html;
        }
        $tr = self::originFor('tavla') . $slug;
        $en = self::originFor('gammon') . $slug;
        $tags = '<link rel="alternate" hreflang="tr" href="' . $tr . '" />'
            . '<link rel="alternate" hreflang="en" href="' . $en . '" />'
            . '<link rel="alternate" hreflang="x-default" href="' . $tr . '" />';
        $out = preg_replace_callback('~</head>~i', static fn () => $tags . '</head>', $html, 1);

        return $out ?? $html;
    }

    /** JS kapalı crawler için başlık, açıklama ve landing içeriği üretir. */
    private static function renderNoscript(string $h1, string $desc, ?array $landing): string
    {
        $body = '';
        if ($landing !== null) {
            [$heading, $paragraph, $items] = $landing;
            $heading = htmlspecialchars($heading, ENT_QUOTES, 'UTF-8');
            $paragraph = htmlspecialchars($paragraph, ENT_QUOTES, 'UTF-8');
            $list = '';
            foreach ($items as $item) {
                $list .= '<li>' . htmlspecialchars($item, ENT_QUOTES, 'UTF-8') . '</li>';
            }
            $body = "<section><h2>{$heading}</h2><p>{$paragraph}</p><ul>{$list}</ul></section>";
        }

        // Marka diline göre gezinme (slug'lar iki domainde de Türkçe; yalnız etiketler değişir).
        if (self::isDefaultBrand()) {
            $nav = '<nav aria-label="TavlaTV bağlantıları"><a href="/online-tavla">Online Tavla Oyna</a> · <a href="/tavla-rehberi">Tavla Rehberi</a> · <a href="/nasil-oynanir">Tavla Kuralları</a> · <a href="/haberler">Tavla Haberleri</a></nav>';
        } else {
            $brand = htmlspecialchars(self::brandName(), ENT_QUOTES, 'UTF-8');
            $nav = '<nav aria-label="' . $brand . ' links"><a href="/online-tavla">Play Backgammon Online</a> · <a href="/tavla-rehberi">Backgammon Guide</a> · <a href="/nasil-oynanir">Backgammon Rules</a> · <a href="/haberler">Backgammon News</a></nav>';
        }

        return "<noscript><main><h1>{$h1}</h1><p>{$desc}</p>{$body}{$nav}</main></noscript>";
    }

    /**
     * Tavla Rehberi yazısı için BlogPosting JSON-LD'yi </head>'den hemen önce enjekte eder.
     * Yalnız kesin/doğru alanlar kullanılır (headline, description, url, inLanguage, author,
     * publisher, mainEntityOfPage). Tarih uydurulmaz. </head> yoksa HTML dokunulmaz döner.
     */
    private static function injectJsonLd(
        string $html,
        string $h1,
        string $desc,
        string $url,
        ?string $datePublished = null,
        ?string $dateModified = null,
    ): string
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'BlogPosting',
            'headline' => $h1,
            'description' => $desc,
            'url' => $url,
            'inLanguage' => self::brandLang(),
            'image' => [self::$base . 'og-image.jpg'],
            'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
            'author' => ['@type' => 'Organization', 'name' => 'TavlaTv'],
            'publisher' => [
                '@type' => 'Organization',
                'name' => 'TavlaTv',
                'logo' => ['@type' => 'ImageObject', 'url' => self::$base . 'icon-512.png'],
            ],
        ];
        if ($datePublished !== null) {
            $data['datePublished'] = $datePublished;
        }
        if ($dateModified !== null) {
            $data['dateModified'] = $dateModified;
        }
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return $html;
        }
        $script = '<script type="application/ld+json">' . $json . '</script>';
        $out = preg_replace_callback('~</head>~i', fn () => $script . '</head>', $html, 1);

        return $out ?? $html;
    }

    /** Yayındaki haberler için yalnız veritabanındaki gerçek alanlardan Article JSON-LD üretir. */
    private static function injectArticleJsonLd(
        string $html,
        string $headline,
        string $description,
        string $url,
        ?string $image,
        mixed $publishedAt = null,
        mixed $modifiedAt = null,
    ): string {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'Article',
            'headline' => $headline,
            'description' => $description,
            'url' => $url,
            'inLanguage' => 'tr',
            'articleSection' => 'Tavla Haberleri',
            'author' => ['@type' => 'Organization', 'name' => 'TavlaTV'],
            'publisher' => [
                '@type' => 'Organization',
                'name' => 'TavlaTV',
                'logo' => ['@type' => 'ImageObject', 'url' => self::$base . 'icon-512.png'],
            ],
            'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
        ];
        if ($image !== null) {
            $data['image'] = [$image];
        }
        if ($publishedAt !== null) {
            $data['datePublished'] = self::schemaDate($publishedAt);
        }
        if ($modifiedAt !== null) {
            $data['dateModified'] = self::schemaDate($modifiedAt);
        }

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return $html;
        }
        $script = '<script type="application/ld+json">' . $json . '</script>';
        $out = preg_replace_callback('~</head>~i', static fn () => $script . '</head>', $html, 1);

        return $out ?? $html;
    }

    private static function schemaDate(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return (string) $value;
    }

    /** Static public rotanın kendi URL'sini WebPage olarak bildirir. */
    private static function injectWebPageJsonLd(string $html, string $name, string $description, string $url, string $inLanguage = 'tr'): string
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'WebPage',
            'name' => $name,
            'description' => $description,
            'url' => $url,
            'inLanguage' => $inLanguage,
            'isPartOf' => ['@type' => 'WebSite', '@id' => self::$base . '#website'],
        ];
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return $html;
        }
        $script = '<script type="application/ld+json">' . $json . '</script>';
        $out = preg_replace_callback('~</head>~i', static fn () => $script . '</head>', $html, 1);

        return $out ?? $html;
    }

    /** Tavla Oyna landing'ini oynanabilir bir web oyunu olarak açıkça bildirir. */
    private static function injectVideoGameJsonLd(string $html, string $name, string $description, string $url, string $inLanguage = 'tr'): string
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'VideoGame',
            'name' => $name,
            'description' => $description,
            'url' => $url,
            'image' => [self::$base . 'og-image.jpg'],
            'inLanguage' => $inLanguage,
            'genre' => ['Backgammon', 'Tavla', 'Board Game'],
            'applicationCategory' => 'Game',
            'operatingSystem' => 'Web',
            'playMode' => ['SinglePlayer', 'MultiPlayer'],
            'offers' => [
                '@type' => 'Offer',
                'price' => '0',
                'priceCurrency' => 'TRY',
            ],
        ];
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return $html;
        }
        $script = '<script type="application/ld+json">' . $json . '</script>';
        $out = preg_replace_callback('~</head>~i', static fn () => $script . '</head>', $html, 1);

        return $out ?? $html;
    }

    /**
     * BreadcrumbList JSON-LD. GÖRÜNÜR breadcrumb (frontend src/ui/Breadcrumb.tsx) ile AYNI
     * hiyerarşi — tek şema, çakışma yok. Ana Sayfa OTOMATİK ilk basamak olarak eklenir; $trail
     * yalnız ARADAKI + mevcut basamakları içerir: [[ad, mutlakUrl], ...] (son = mevcut sayfa).
     * Örn. makale: [['Makaleler', BASE.'makaleler'], [başlık, url]] -> Ana Sayfa › Makaleler › Başlık.
     *
     * @param array<int, array{0:string,1:string}> $trail
     */
    private static function injectBreadcrumbJsonLd(string $html, array $trail, string $homeLabel = 'Ana Sayfa'): string
    {
        $items = [[
            '@type' => 'ListItem',
            'position' => 1,
            'name' => $homeLabel,
            'item' => self::$base,
        ]];
        foreach ($trail as $i => [$name, $url]) {
            $items[] = [
                '@type' => 'ListItem',
                'position' => $i + 2,
                'name' => $name,
                'item' => $url,
            ];
        }
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => $items,
        ];
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return $html;
        }
        $script = '<script type="application/ld+json">' . $json . '</script>';
        $out = preg_replace_callback('~</head>~i', static fn () => $script . '</head>', $html, 1);

        return $out ?? $html;
    }

    /** Yayındaki haberler içinde slug'ı frontend slugify(title) ile eşleşeni bul. */
    private static function findNews(string $slug): ?Content
    {
        if (! Schema::hasTable('contents')) {
            return null;
        }

        $rows = Content::query()
            ->where('type', 'news')
            ->where('published', true)
            ->get(['id', 'title', 'body', 'image', 'event_at', 'updated_at']);

        foreach ($rows as $row) {
            if (self::slugify((string) $row->title) === $slug) {
                return $row;
            }
        }

        return null;
    }

    /** Yayındaki makaleler içinde frontend slugify() ile eşleşeni bul. */
    private static function findMakale(string $slug): ?Content
    {
        if (! Schema::hasTable('contents')) {
            return null;
        }

        $rows = Content::query()
            ->where('type', 'makale')
            ->where('published', true)
            ->get(['id', 'title', 'slug', 'body', 'image', 'event_at', 'updated_at']);

        foreach ($rows as $row) {
            // Kısa (SEO) slug otoritif; boşsa başlıktan türet (geriye dönük).
            $rowSlug = $row->slug ? (string) $row->slug : self::slugify((string) $row->title);
            if ($rowSlug === $slug) {
                return $row;
            }
        }

        return null;
    }

    /** frontend ContentView.tsx slugify() ile bayt-bayt aynı: TR harf eşleme + [^a-z0-9]->-. */
    private static function slugify(string $s): string
    {
        $map = [
            'ç' => 'c', 'ğ' => 'g', 'ı' => 'i', 'ö' => 'o', 'ş' => 's', 'ü' => 'u',
            'İ' => 'i', 'Ç' => 'c', 'Ğ' => 'g', 'Ö' => 'o', 'Ş' => 's', 'Ü' => 'u',
        ];
        $s = strtr($s, $map);
        $s = mb_strtolower($s, 'UTF-8');
        $s = preg_replace('/[^a-z0-9]+/', '-', $s);

        return trim((string) $s, '-');
    }

    /** HTML gövdeyi düz-metin özete indir (~200 karakter). */
    private static function excerpt(?string $body): string
    {
        $text = trim((string) preg_replace('/\s+/', ' ', strip_tags((string) $body)));
        if ($text === '') {
            return '';
        }
        if (mb_strlen($text) > 200) {
            $text = mb_substr($text, 0, 197) . '…';
        }

        return $text;
    }

    /** Görsel yolunu mutlak URL'e çevir (frontend mediaSrc mantığı + BASE ön-ek). */
    private static function absImg(?string $img): ?string
    {
        if (! $img) {
            return null;
        }
        if (preg_match('#^https?://#i', $img)) {
            return $img;
        }
        $base = rtrim(self::$base, '/');

        return $img[0] === '/' ? $base . $img : $base . '/uploads/' . $img;
    }

    /**
     * Paylaşım (og:image) için küçük JPEG variant üret: 1200×630 cover-crop, kalite ~82,
     * public/uploads/og/<key>.jpg'e cache'lenir, ABSOLUTE url döner. WhatsApp ~600 KB üstü
     * og:image'ı önizlemede GÖSTERMEZ -> ham ~2 MB makale/haber görseli paylaşımda ÇIKMAZ;
     * bu variant tipik ~100-250 KB. Üretilemezse (harici url / dosya yok / GD yok / çok büyük)
     * null döner -> çağıran ham görsele (absImg) düşer; davranış bozulmaz.
     */
    private static function ogVariant(?string $img): ?string
    {
        if (! $img || preg_match('#^https?://#i', $img)) {
            return null; // harici/boş -> variant yok (ham absImg kullanılır)
        }
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagejpeg') || ! function_exists('getimagesize')) {
            return null;
        }
        $rel = $img[0] === '/' ? ltrim($img, '/') : 'uploads/' . $img;
        $srcAbs = public_path($rel);
        if (! is_file($srcAbs)) {
            return null;
        }
        $info = @getimagesize($srcAbs);
        if ($info === false) {
            return null;
        }
        // Çözülünce belleği taşıracak devasa görseli işleme (fatal yerine ham'a düş).
        if ((int) ($info[0] ?? 0) * (int) ($info[1] ?? 0) > 40_000_000) {
            return null;
        }
        $key = substr(md5($rel . '|' . (@filemtime($srcAbs) ?: 0)), 0, 24);
        $outRel = 'uploads/og/' . $key . '.jpg';
        $outAbs = public_path($outRel);
        if (! is_file($outAbs)) {
            $data = @file_get_contents($srcAbs);
            if ($data === false) {
                return null;
            }
            $src = @imagecreatefromstring($data);
            if (! $src) {
                return null;
            }
            $sw = imagesx($src);
            $sh = imagesy($src);
            $TW = 1200;
            $TH = 630;
            $dstRatio = $TW / $TH;
            $srcRatio = $sh > 0 ? $sw / $sh : $dstRatio;
            if ($srcRatio > $dstRatio) { // kaynak daha geniş -> yanlardan kırp
                $ch = $sh;
                $cw = (int) round($sh * $dstRatio);
                $cx = (int) round(($sw - $cw) / 2);
                $cy = 0;
            } else { // daha uzun -> üstten/alttan kırp
                $cw = $sw;
                $ch = (int) round($sw / $dstRatio);
                $cx = 0;
                $cy = (int) round(($sh - $ch) / 2);
            }
            $dst = imagecreatetruecolor($TW, $TH);
            $white = imagecolorallocate($dst, 255, 255, 255); // JPEG alfa yok -> beyaz zemin
            imagefilledrectangle($dst, 0, 0, $TW, $TH, $white);
            imagecopyresampled($dst, $src, 0, 0, $cx, $cy, $TW, $TH, max(1, $cw), max(1, $ch));
            @mkdir(dirname($outAbs), 0755, true);
            ob_start();
            $ok = imagejpeg($dst, null, 82);
            $buf = ob_get_clean();
            imagedestroy($src);
            imagedestroy($dst);
            if (! $ok || $buf === '' || @file_put_contents($outAbs, $buf) === false) {
                return null;
            }
        }

        return rtrim(self::$base, '/') . '/' . $outRel;
    }
}
