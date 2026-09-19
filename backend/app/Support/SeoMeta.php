<?php

namespace App\Support;

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
    /** Kanonik kök (apex -> www 301). Slug bununla birleşir: BASE . 'haberler'. */
    private const BASE = 'https://www.tavlatv.com/';

    /**
     * slug => [title, desc, h1]
     * title: <title> + og:title + twitter:title
     * desc:  meta description + og:description + twitter:description + <noscript> <p>
     * h1:    <noscript> <h1> (JS'siz tarayıcıların gördüğü başlık)
     */
    private const META = [
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
        'tavla-magazin' => [
            'Tavla Magazin | TavlaTv',
            'Tavla magazin: turnuva röportajları, maç öyküleri ve tavla camiasından haberler.',
            'Tavla Magazin',
        ],
        'pozisyon-analizi' => [
            'Tavla Pozisyon Analizi | TavlaTv',
            'Tavla pozisyon analizi aracı: gnubg ve nöral ağ ile herhangi bir tavla pozisyonunu ücretsiz analiz et.',
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
     * index.html içeriğini, istenen yola göre per-route SEO etiketleriyle döndür.
     * Slug META'da yoksa içerik DEĞİŞMEDEN döner (homepage/bilinmeyen = mevcut davranış).
     */
    public static function inject(string $path, string $html): string
    {
        $slug = trim($path, '/');
        if ($slug === '' || ! isset(self::META[$slug])) {
            return $html;
        }

        [$title, $desc, $h1] = self::META[$slug];
        $url = self::BASE . $slug;

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
            '~<meta\s+name="twitter:title"\s+content="[^"]*"\s*/?>~s' => "<meta name=\"twitter:title\" content=\"{$tTitle}\" />",
            '~<meta\s+name="twitter:description"\s+content="[^"]*"\s*/?>~s' => "<meta name=\"twitter:description\" content=\"{$tDesc}\" />",
            // JS'siz tarayıcıların gördüğü H1 + açıklama: per-route yap.
            '~<noscript>.*?</noscript>~s' => "<noscript><h1>{$tH1}</h1><p>{$tDesc}</p></noscript>",
        ];

        foreach ($subs as $pattern => $replacement) {
            $out = preg_replace($pattern, $replacement, $html, 1);
            if ($out !== null) {
                $html = $out; // preg hatasında (null) o adımı atla, HTML'i bozma
            }
        }

        return $html;
    }
}
