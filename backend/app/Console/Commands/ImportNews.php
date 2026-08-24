<?php

namespace App\Console\Commands;

use App\Models\Content;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * TavlaTv blogundaki (Wix) haberleri RSS feed'inden cekip 'news' icerigi olarak
 * iceri aktarir. Baslik uzerinden updateOrCreate -> tekrar calistirmak guvenli
 * (var olanlari gunceller, yenileri ekler). Gorseller Wix CDN URL'i olarak saklanir.
 *
 * Kullanim:  php artisan news:import
 *            php artisan news:import --url=https://www.tavlatv.com/blog-feed.xml
 *            php artisan news:import --dry   (yazmadan neyi alacagini goster)
 */
class ImportNews extends Command
{
    protected $signature = 'news:import
        {--url=https://www.tavlatv.com/blog-feed.xml : RSS/Atom feed adresi}
        {--file= : RSS yerine yerel JSON dosyasindan yukle (offline; deploy icin)}
        {--dry : Veritabanina yazmadan sadece bulunanlari listele}
        {--no-detail : Post sayfasini cekme; sadece feed ozeti + kapak gorseli}
        {--no-images : Gorselleri indirme, uzak (Wix) URL\'ini oldugu gibi sakla}
        {--force-images : Yerelde ayni dosya olsa bile gorseli tekrar indir}';

    protected $description = 'TavlaTv blog RSS feed\'inden haberleri (gorselleriyle) news icerigine aktarir';

    /** Indirilen gorsellerin gidecegi klasor (web kok dizini altinda). */
    private const IMAGE_DIR = 'news';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $file = (string) $this->option('file');

        // Kaynak: --file verilmisse yerel JSON (offline), yoksa RSS feed.
        if ($file !== '') {
            $path = $this->resolveFile($file);
            if ($path === null) {
                $this->error("JSON dosyasi bulunamadi: {$file}");
                return self::FAILURE;
            }
            $this->info("Yerel dosyadan yukleniyor: {$path}");
            $items = $this->parseJson((string) file_get_contents($path));
            if (empty($items)) {
                $this->warn('JSON dosyasinda haber bulunamadi (bos veya gecersiz).');
                return self::FAILURE;
            }
        } else {
            $url = (string) $this->option('url');
            $this->info("Feed cekiliyor: {$url}");
            try {
                $res = Http::timeout(20)
                    ->withHeaders(['User-Agent' => 'TavlaTvBot/1.0 (+https://www.tavlatv.com)'])
                    ->get($url);
            } catch (\Throwable $e) {
                $this->error('Feed cekilemedi: '.$e->getMessage());
                return self::FAILURE;
            }
            if (! $res->ok()) {
                $this->error('Feed HTTP hatasi: '.$res->status());
                return self::FAILURE;
            }
            $items = $this->parse($res->body());
            if (empty($items)) {
                $this->warn('Feed\'te haber bulunamadi (bos veya bicim taninmadi).');
                return self::FAILURE;
            }
        }

        $this->info(count($items).' haber bulundu.');
        $created = 0;
        $updated = 0;
        $downloaded = 0;
        $withImages = ! $this->option('no-images') && ! $dry;
        $force = (bool) $this->option('force-images');
        // Detay sayfasi (tam metin + galeri) yalnizca feed modunda cekilir.
        // --file offline modunda govde/galeri zaten JSON'da hazir.
        $detail = ! $this->option('no-detail') && $file === '' && ! $dry;
        if ($withImages) {
            @mkdir(public_path(self::IMAGE_DIR), 0755, true);
        }

        // En eski en dusuk sort olacak sekilde: en yeni en ustte gorunur.
        // (Frontend zaten event_at DESC siraliyor; sort ikincil.)
        $n = count($items);
        foreach ($items as $i => $it) {
            $sort = $n - $i; // ilk (en yeni) en yuksek sort
            $this->line(sprintf(
                ' • %s  [%s]%s',
                $it['title'],
                $it['event_at'] ?? '—',
                $it['image'] ? '  🖼' : '',
            ));

            if ($dry) {
                continue;
            }

            // Kaynak gorsel listesi: kapak + (varsa) mevcut galeri
            $body = $it['body'];
            $srcImages = [];
            if ($it['image']) {
                $srcImages[] = $it['image'];
            }
            foreach ($it['gallery'] as $g) {
                $srcImages[] = $g;
            }

            // Detay sayfasindan tam metin + icerik gorselleri (feed modu)
            if ($detail && $it['link']) {
                $d = $this->scrapePost($it['link']);
                if ($d !== null) {
                    // Post govdesi feed ozetinden daha tamsa onu kullan
                    if ($d['body'] !== null && mb_strlen($d['body']) > mb_strlen((string) $body)) {
                        $body = $d['body'];
                    }
                    foreach ($d['images'] as $u) {
                        $srcImages[] = $u;
                    }
                } else {
                    $this->warn("   ! detay cekilemedi: {$it['link']}");
                }
            }

            // Gorselleri yerele indir; kopyalari (kapak == ilk galeri) hash ile ele.
            $localImages = [];
            foreach ($srcImages as $src) {
                if (str_starts_with($src, '/')) { // zaten yerel yol
                    if (! in_array($src, $localImages, true)) {
                        $localImages[] = $src;
                    }
                    continue;
                }
                if (! $withImages) {
                    if (! in_array($src, $localImages, true)) {
                        $localImages[] = $src;
                    }
                    continue;
                }
                $local = $this->downloadImage($src, $force);
                if ($local !== null) {
                    if ($local['fetched']) {
                        $downloaded++;
                    }
                    if (! in_array($local['url'], $localImages, true)) {
                        $localImages[] = $local['url'];
                    }
                } else {
                    $this->warn("   ! gorsel indirilemedi: {$src}");
                }
            }

            $cover = $localImages[0] ?? null;
            $gallery = array_slice($localImages, 1);
            $this->line(sprintf('   govde %d krk, %d gorsel', mb_strlen((string) $body), count($localImages)));

            $existing = Content::where('type', 'news')->where('title', $it['title'])->first();
            Content::updateOrCreate(
                ['type' => 'news', 'title' => $it['title']],
                [
                    'body' => $body,
                    'image' => $cover,
                    'gallery' => $gallery ?: null,
                    'event_at' => $it['event_at'],
                    'sort' => $sort,
                    'published' => true,
                ],
            );
            $existing ? $updated++ : $created++;
        }

        if ($dry) {
            $this->comment('Kuru calisma (--dry): hicbir sey yazilmadi.');
        } else {
            $extra = $withImages ? ", {$downloaded} gorsel indirildi" : '';
            $this->info("Tamam: {$created} yeni, {$updated} guncellendi{$extra}.");
        }
        return self::SUCCESS;
    }

    /**
     * Uzak gorseli public/news/ altina indirir, sitedeki goreli URL'i ("/news/...") dondurur.
     * Idempotent: ayni kaynaktan uretilen dosya adi sabit -> tekrar calistirinca yeniden indirmez.
     * @return array{url:string, fetched:bool}|null  Basarili: url + indirildi mi; hata: null
     */
    private function downloadImage(string $src, bool $force): ?array
    {
        // Kaynak medyanin temel URL'i: Wix donusturme ekini ("/v1/...") at.
        // Dosya adi bu temel URL'den turer -> render boyutu degisse de idempotent.
        $base = $src;
        if (($pos = strpos($base, '/v1/')) !== false) {
            $base = substr($base, 0, $pos);
        }

        // Wix ise ham orijinal (cok buyuk olabilir) yerine sinirli render iste:
        // en fazla 1600px genislik, q_85 -> iyi kalite, makul dosya boyutu.
        $origin = $src;
        $host = strtolower((string) parse_url($src, PHP_URL_HOST));
        if (str_contains($host, 'wixstatic.com') && str_contains($base, '/media/')) {
            // fit + kare sinir kutusu: en-boy orani korunur, en uzun kenar <= 1600px.
            // (Wix 'fit' donusumu h_ parametresini zorunlu ister.)
            $origin = $base.'/v1/fit/w_1600,h_1600,al_c,q_85/file.jpg';
        }

        // Sabit dosya adi (uzanti Content-Type'tan netlesir)
        $hash = substr(sha1($base), 0, 16);
        $ext = $this->extFromUrl($base);
        $existingUrl = $this->findExisting($hash);
        if ($existingUrl !== null && ! $force) {
            return ['url' => $existingUrl, 'fetched' => false]; // zaten indirilmis
        }

        try {
            $res = Http::timeout(30)
                ->withHeaders(['User-Agent' => 'TavlaTvBot/1.0 (+https://www.tavlatv.com)'])
                ->get($origin);
        } catch (\Throwable $e) {
            return null;
        }
        if (! $res->ok()) {
            return null;
        }

        // Gercek uzantiyi Content-Type'tan belirle (Wix bazen /file.png ile jpg dondurur)
        $ct = strtolower($res->header('Content-Type'));
        $ext = match (true) {
            str_contains($ct, 'jpeg'), str_contains($ct, 'jpg') => 'jpg',
            str_contains($ct, 'png') => 'png',
            str_contains($ct, 'webp') => 'webp',
            str_contains($ct, 'gif') => 'gif',
            str_contains($ct, 'avif') => 'avif',
            default => $ext,
        };

        $file = $hash.'.'.$ext;
        $path = public_path(self::IMAGE_DIR.DIRECTORY_SEPARATOR.$file);
        if (@file_put_contents($path, $res->body()) === false) {
            return null;
        }
        return ['url' => '/'.self::IMAGE_DIR.'/'.$file, 'fetched' => true];
    }

    /** Bu hash icin daha once indirilmis bir dosya var mi? Varsa goreli URL'ini dondur. */
    private function findExisting(string $hash): ?string
    {
        foreach (['jpg', 'png', 'webp', 'gif', 'avif'] as $ext) {
            if (is_file(public_path(self::IMAGE_DIR.DIRECTORY_SEPARATOR.$hash.'.'.$ext))) {
                return '/'.self::IMAGE_DIR.'/'.$hash.'.'.$ext;
            }
        }
        return null;
    }

    /** URL yolundan uzanti tahmini (Content-Type yoksa yedek). Varsayilan: jpg. */
    private function extFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        return in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'], true)
            ? ($ext === 'jpeg' ? 'jpg' : $ext)
            : 'jpg';
    }

    /** --file degerini gercek yola cevirir: mutlak/cwd/base_path/'backend/' oneki/dosya adi. */
    private function resolveFile(string $file): ?string
    {
        $noBackend = preg_replace('#^/?backend/#', '', $file); // yanlislikla 'backend/' onekini at
        $cands = [
            $file,
            base_path($file),
            base_path($noBackend),
            database_path('data/'.basename($file)), // son care: dosya adiyla data/ altinda ara
        ];
        foreach ($cands as $cand) {
            if (is_file($cand)) {
                return $cand;
            }
        }
        return null;
    }

    /**
     * Yerel JSON'u ayristirir. Beklenen bicim: [{title, body, image, event_at, sort}, ...]
     * @return array<int, array{title:string, body:?string, image:?string, event_at:?string}>
     */
    private function parseJson(string $json): array
    {
        $data = json_decode($json, true);
        if (! is_array($data)) {
            return [];
        }
        $out = [];
        foreach ($data as $row) {
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            $gallery = [];
            if (isset($row['gallery']) && is_array($row['gallery'])) {
                foreach ($row['gallery'] as $g) {
                    $g = (string) $g;
                    if ($g !== '') {
                        $gallery[] = mb_substr($g, 0, 500);
                    }
                }
            }
            $out[] = [
                'title' => mb_substr($title, 0, 200),
                'body' => isset($row['body']) && $row['body'] !== '' ? mb_substr((string) $row['body'], 0, 20000) : null,
                'image' => isset($row['image']) && $row['image'] !== '' ? mb_substr((string) $row['image'], 0, 500) : null,
                'gallery' => $gallery,
                'link' => isset($row['link']) && $row['link'] !== '' ? (string) $row['link'] : null,
                'event_at' => isset($row['event_at']) && $row['event_at'] !== '' ? (string) $row['event_at'] : null,
            ];
        }
        return $out;
    }

    /**
     * RSS 2.0 / Atom feed'ini SimpleXML ile ayristirir.
     * Her ogeden: baslik, ozet metin (HTML temizlenmis), gorsel URL'i, yayin tarihi.
     * @return array<int, array{title:string, body:?string, image:?string, event_at:?string}>
     */
    private function parse(string $xml): array
    {
        $prev = libxml_use_internal_errors(true);
        $doc = simplexml_load_string($xml);
        libxml_use_internal_errors($prev);
        if ($doc === false) {
            return [];
        }

        $out = [];

        // RSS 2.0:  <rss><channel><item>...
        $nodes = $doc->channel->item ?? null;
        // Atom:     <feed><entry>...
        if ($nodes === null || count($nodes) === 0) {
            $nodes = $doc->entry ?? null;
        }
        if ($nodes === null) {
            return [];
        }

        foreach ($nodes as $node) {
            $title = trim((string) ($node->title ?? ''));
            if ($title === '') {
                continue;
            }

            // Ozet/govde: <description> (RSS) veya <content>/<summary> (Atom)
            $rawBody = (string) ($node->description ?? '');
            if ($rawBody === '') {
                $rawBody = (string) ($node->content ?? $node->summary ?? '');
            }

            $image = $this->extractImage($node, $rawBody);
            $body = $this->cleanHtml($rawBody);

            // Tarih: <pubDate> (RSS) veya <published>/<updated> (Atom)
            $date = (string) ($node->pubDate ?? '');
            if ($date === '') {
                $date = (string) ($node->published ?? $node->updated ?? '');
            }
            $eventAt = null;
            if ($date !== '') {
                $ts = strtotime($date);
                if ($ts !== false) {
                    $eventAt = date('Y-m-d H:i:s', $ts);
                }
            }

            // Post detay sayfasi adresi (tam metin + galeri icin)
            $link = trim((string) ($node->link ?? ''));
            if ($link === '' && isset($node->link['href'])) {
                $link = (string) $node->link['href']; // Atom
            }

            $out[] = [
                'title' => mb_substr($title, 0, 200),
                'body' => $body !== '' ? mb_substr($body, 0, 20000) : null,
                'image' => $image ? mb_substr($image, 0, 500) : null,
                'gallery' => [],
                'link' => $link !== '' ? $link : null,
                'event_at' => $eventAt,
            ];
        }

        return $out;
    }

    /** Ogeden gorsel URL'i: enclosure -> media namespace -> govdedeki ilk <img>. */
    private function extractImage(\SimpleXMLElement $node, string $body): ?string
    {
        // 1) <enclosure url="..." type="image/..."/>
        if (isset($node->enclosure)) {
            $enc = $node->enclosure->attributes();
            $type = (string) ($enc['type'] ?? '');
            $u = (string) ($enc['url'] ?? '');
            if ($u !== '' && (str_starts_with($type, 'image') || $type === '')) {
                return $u;
            }
        }

        // 2) media: namespace (<media:content>, <media:thumbnail>)
        $media = $node->children('http://search.yahoo.com/mrss/');
        foreach (['content', 'thumbnail'] as $tag) {
            if (isset($media->$tag)) {
                $u = (string) $media->$tag->attributes()['url'];
                if ($u !== '') {
                    return $u;
                }
            }
        }

        // 3) Govde HTML'indeki ilk <img src="...">
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $body, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        return null;
    }

    /**
     * Wix post detay sayfasindan tam govdeyi ve icerik gorsellerini cikarir.
     * Govde: data-hook="post-description" kapsayicisi. Gorseller: o kapsayicidaki
     * wow-image id'leri + image-viewer <img> kaynaklari (media dosya adi).
     * @return array{body:?string, images:array<int,string>}|null
     */
    private function scrapePost(string $url): ?array
    {
        try {
            $res = Http::timeout(30)
                ->withHeaders(['User-Agent' => 'TavlaTvBot/1.0 (+https://www.tavlatv.com)'])
                ->get($url);
        } catch (\Throwable $e) {
            return null;
        }
        if (! $res->ok()) {
            return null;
        }

        $prev = libxml_use_internal_errors(true);
        $doc = new \DOMDocument();
        $doc->loadHTML('<?xml encoding="utf-8"?>'.$res->body());
        libxml_use_internal_errors($prev);
        $xp = new \DOMXPath($doc);

        // Govde: post-description ic HTML'i -> temiz metin
        $body = null;
        $desc = $xp->query("//*[@data-hook='post-description']")->item(0);
        if ($desc) {
            $inner = '';
            foreach ($desc->childNodes as $c) {
                $inner .= $doc->saveHTML($c);
            }
            $t = $this->cleanHtml($inner);
            $body = $t !== '' ? mb_substr($t, 0, 20000) : null;
        }

        // Icerik gorselleri (sirali): once makale icindeki wow-image, sonra image-viewer
        $ids = [];
        foreach ($xp->query("//*[@data-hook='post-description']//wow-image/@id") as $a) {
            $this->collectMediaId($a->value, $ids);
        }
        foreach ($xp->query("//*[starts-with(@data-hook,'image-viewer')]//img/@src") as $a) {
            $this->collectMediaId($a->value, $ids);
        }
        // media dosya adi -> temel Wix URL (downloadImage render + hash ile dedup eder)
        $images = array_map(
            static fn ($id) => 'https://static.wixstatic.com/media/'.$id,
            array_values(array_unique($ids)),
        );

        return ['body' => $body, 'images' => $images];
    }

    /** wixstatic media dosya adini (id ya da /media/ URL'inden) $ids'e ekler. */
    private function collectMediaId(string $val, array &$ids): void
    {
        if (preg_match('#^[a-z0-9]+_[a-f0-9]+~mv2\.(?:jpg|jpeg|png)$#i', $val)) {
            $ids[] = $val;
        } elseif (preg_match('#/media/([a-z0-9]+_[a-f0-9]+~mv2\.(?:jpg|jpeg|png))#i', $val, $m)) {
            $ids[] = $m[1];
        }
    }

    /** HTML etiketlerini temizler, bosluklari normalize eder. */
    private function cleanHtml(string $html): string
    {
        $text = preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/is', '', $html) ?? $html;
        // Paragraf/br sonlarini yeni satira cevir (frontend \n\n -> paragraf)
        $text = preg_replace('/<\/(p|div|h[1-6]|li)>/i', "\n\n", $text) ?? $text;
        $text = preg_replace('/<br\s*\/?>/i', "\n", $text) ?? $text;
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
        $text = preg_replace('/\n{3,}/', "\n\n", $text) ?? $text;
        return trim($text);
    }
}
