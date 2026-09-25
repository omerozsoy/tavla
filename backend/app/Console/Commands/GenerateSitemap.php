<?php

namespace App\Console\Commands;

use App\Models\Content;
use Illuminate\Console\Command;

/**
 * Statik SEO sitemap'ine yayındaki haber URL'lerini ekler.
 * Taslak/silinmiş içerikler sorguya hiç alınmaz; aynı slug yalnız bir kez yazılır.
 */
class GenerateSitemap extends Command
{
    protected $signature = 'seo:sitemap {--dry-run : Dosyaya yazmadan XML çıktısını göster}';

    protected $description = 'Yayındaki haberleri sitemap.xml ile senkronlar';

    public function handle(): int
    {
        $path = public_path('sitemap.xml');
        if (! is_file($path)) {
            $this->error('Sitemap bulunamadı: '.$path);

            return self::FAILURE;
        }

        $xml = file_get_contents($path);
        if ($xml === false || ! str_contains($xml, '</urlset>')) {
            $this->error('Sitemap XML biçimi geçersiz.');

            return self::FAILURE;
        }

        // Önceki çalışmaların YÖNETİLEN bloklarını soy -> temiz statik taban (curated URL'ler) kalır.
        $xml = $this->stripBlock($xml, 'seo pages');
        $xml = $this->stripBlock($xml, 'dynamic news');

        // Statik tabanda ZATEN olan loc'lar -> tekrar ekleme (elle konmuş curated önceliği korunur).
        preg_match_all('~<loc>\s*([^<]+?)\s*</loc>~', $xml, $mm);
        $existing = [];
        foreach ($mm[1] as $loc) {
            $existing[html_entity_decode($loc, ENT_QUOTES | ENT_XML1, 'UTF-8')] = true;
        }

        [$seoBlock, $seoCount] = $this->seoPagesBlock($existing);
        [$newsBlock, $newsCount] = $this->newsBlock();

        $insert = ($seoBlock !== '' ? $seoBlock."\n" : '').$newsBlock;
        $xml = str_replace('</urlset>', $insert."\n</urlset>", $xml);

        if ($this->option('dry-run')) {
            $this->line($xml);
            $this->info("Özet (dry-run): eksik SEO sayfası +{$seoCount}, yayındaki haber {$newsCount}.");

            return self::SUCCESS;
        }

        $tmp = $path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if (file_put_contents($tmp, $xml, LOCK_EX) === false || ! rename($tmp, $path)) {
            @unlink($tmp);
            $this->error('Sitemap yazılamadı: '.$path);

            return self::FAILURE;
        }

        $this->info("Sitemap güncellendi: {$newsCount} haber URL'si senkronlandı; eksik SEO sayfası eklendi: {$seoCount}.");

        return self::SUCCESS;
    }

    /** Yönetilen bir bloğu (<!-- TavlaTV {name}:start --> … :end -->) XML'den çıkarır (idempotent re-run). */
    private function stripBlock(string $xml, string $name): string
    {
        $q = preg_quote($name, '~');
        $pattern = '~\s*<!-- TavlaTV '.$q.':start -->.*?<!-- TavlaTV '.$q.':end -->~s';

        return preg_replace($pattern, '', $xml) ?? $xml;
    }

    /**
     * SEO META'sı tanımlı (indekslenmesi istenen) ama sitemap'te OLMAYAN sayfaları üretir. Yeni bir
     * sayfa (ör. Sıkça Sorulan Sorular / Sözlük) eklenip sitemap elle güncellenmese bile buradan
     * otomatik dolar -> "sayfa ekledim sitemap'te yok" sorunu tekrar etmez. Tek kaynak: SeoMeta.
     *
     * @param  array<string,bool>  $existing  Statik tabanda zaten bulunan mutlak URL'ler
     * @return array{0:string,1:int}
     */
    private function seoPagesBlock(array $existing): array
    {
        $urls = [];
        foreach (\App\Support\SeoMeta::indexableUrls() as $url) {
            if (isset($existing[$url])) {
                continue; // curated girişi ez -> önceliği/lastmod'u koru
            }
            $urls[] = "  <url>\n    <loc>".htmlspecialchars($url, ENT_XML1, 'UTF-8')."</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>";
        }

        if ($urls === []) {
            return ['', 0];
        }

        return ["  <!-- TavlaTV seo pages:start -->\n".implode("\n", $urls)."\n  <!-- TavlaTV seo pages:end -->", count($urls)];
    }

    /** @return array{0:string,1:int} */
    private function newsBlock(): array
    {
        $seen = [];
        $rows = Content::query()
            ->where('type', 'news')
            ->where('published', true)
            ->orderByDesc('updated_at')
            ->get(['title', 'updated_at']);

        $urls = [];
        foreach ($rows as $row) {
            $slug = $this->slugify((string) $row->title);
            if ($slug === '' || isset($seen[$slug])) {
                continue;
            }
            $seen[$slug] = true;
            $lastmod = $row->updated_at?->toDateString() ?: now()->toDateString();
            $url = 'https://www.tavlatv.com/haberler/'.$slug;
            $urls[] = "  <url>\n    <loc>".htmlspecialchars($url, ENT_XML1, 'UTF-8')."</loc>\n    <lastmod>{$lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>";
        }

        if ($urls === []) {
            return ["  <!-- TavlaTV dynamic news:start -->\n  <!-- No published news -->\n  <!-- TavlaTV dynamic news:end -->", 0];
        }

        return ["  <!-- TavlaTV dynamic news:start -->\n".implode("\n", $urls)."\n  <!-- TavlaTV dynamic news:end -->", count($urls)];
    }

    private function slugify(string $value): string
    {
        $value = strtr($value, [
            'ç' => 'c', 'ğ' => 'g', 'ı' => 'i', 'ö' => 'o', 'ş' => 's', 'ü' => 'u',
            'İ' => 'i', 'Ç' => 'c', 'Ğ' => 'g', 'Ö' => 'o', 'Ş' => 's', 'Ü' => 'u',
        ]);
        $value = mb_strtolower($value, 'UTF-8');
        $value = preg_replace('/[^a-z0-9]+/', '-', $value);

        return trim((string) $value, '-');
    }
}
