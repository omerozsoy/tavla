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
    /** Kanonik kök (apex -> www 301). Slug bununla birleşir: BASE . 'haberler'. */
    private const BASE = 'https://www.tavlatv.com/';

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

    /**
     * index.html içeriğini, istenen yola göre per-route SEO etiketleriyle döndür.
     * Slug ne statik META'da ne de dinamik haber olarak eşleşirse içerik DEĞİŞMEDEN
     * döner (homepage/bilinmeyen = mevcut davranış).
     */
    public static function inject(string $path, string $html): string
    {
        $slug = trim($path, '/');
        if ($slug === '') {
            return $html;
        }

        if (in_array($slug, self::NOINDEX, true)) {
            return self::applyNoIndex($html);
        }

        // 1) Statik rota META tablosu.
        if (isset(self::META[$slug])) {
            [$title, $desc, $h1] = self::META[$slug];

            return self::apply($html, $title, $desc, $h1, self::BASE . $slug, null, 'website');
        }

        // 2) Dinamik haber makalesi: /haberler/<slug>. Paylaşımda (WhatsApp/Twitter vb.)
        //    makalenin kendi başlığı + özeti + KAPAK GÖRSELİ görünsün diye per-article
        //    og/twitter etiketlerini enjekte et. Slug, frontend slugify(title) ile aynı.
        $parts = explode('/', $slug);

        // 2b) Tavla Rehberi yazısı: /tavla-rehberi/<slug>. Per-article title/desc/h1 +
        //     BlogPosting JSON-LD (yalnız gerçek/doğru alanlarla). guides.ts ile senkron.
        if (count($parts) === 2 && $parts[0] === 'tavla-rehberi' && isset(self::GUIDES[$parts[1]])) {
            [$title, $desc, $h1] = self::GUIDES[$parts[1]];
            $url = self::BASE . $slug;
            $html = self::apply($html, $title, $desc, $h1, $url, null, 'article');

            return self::injectJsonLd($html, $h1, $desc, $url);
        }

        if (count($parts) === 2 && $parts[0] === 'haberler') {
            $article = self::findNews($parts[1]);
            if ($article) {
                $title = $article->title . ' | TavlaTv';
                $desc  = self::excerpt($article->body)
                    ?: 'Tavla dünyasından son haberler, turnuva sonuçları ve TavlaTv duyuruları.';

                return self::apply(
                    $html,
                    $title,
                    $desc,
                    (string) $article->title,
                    self::BASE . $slug,
                    self::absImg($article->image),
                    'article',
                );
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
            '~<noscript>.*?</noscript>~s' => "<noscript><h1>{$tH1}</h1><p>{$tDesc}</p></noscript>",
        ];

        if ($image) {
            $tImg = htmlspecialchars($image, ENT_QUOTES, 'UTF-8');
            $subs['~<meta\s+property="og:image"\s+content="[^"]*"\s*/?>~s'] = "<meta property=\"og:image\" content=\"{$tImg}\" />";
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

    /**
     * Tavla Rehberi yazısı için BlogPosting JSON-LD'yi </head>'den hemen önce enjekte eder.
     * Yalnız kesin/doğru alanlar kullanılır (headline, description, url, inLanguage, author,
     * publisher, mainEntityOfPage). Tarih uydurulmaz. </head> yoksa HTML dokunulmaz döner.
     */
    private static function injectJsonLd(string $html, string $h1, string $desc, string $url): string
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'BlogPosting',
            'headline' => $h1,
            'description' => $desc,
            'url' => $url,
            'inLanguage' => 'tr',
            'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
            'author' => ['@type' => 'Organization', 'name' => 'TavlaTv'],
            'publisher' => ['@type' => 'Organization', 'name' => 'TavlaTv'],
        ];
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return $html;
        }
        $script = '<script type="application/ld+json">' . $json . '</script>';
        $out = preg_replace_callback('~</head>~i', fn () => $script . '</head>', $html, 1);

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
            ->get(['id', 'title', 'body', 'image']);

        foreach ($rows as $row) {
            if (self::slugify((string) $row->title) === $slug) {
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
        $base = rtrim(self::BASE, '/');

        return $img[0] === '/' ? $base . $img : $base . '/uploads/' . $img;
    }
}
