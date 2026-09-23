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

        $block = $this->newsBlock();
        $xml = preg_replace(
            '~\s*<!-- TavlaTV dynamic news:start -->.*?<!-- TavlaTV dynamic news:end -->~s',
            '',
            $xml,
        ) ?? $xml;
        $xml = str_replace('</urlset>', $block."\n</urlset>", $xml);

        if ($this->option('dry-run')) {
            $this->line($xml);

            return self::SUCCESS;
        }

        $tmp = $path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if (file_put_contents($tmp, $xml, LOCK_EX) === false || ! rename($tmp, $path)) {
            @unlink($tmp);
            $this->error('Sitemap yazılamadı: '.$path);

            return self::FAILURE;
        }

        $this->info('Sitemap güncellendi: '.$path);

        return self::SUCCESS;
    }

    private function newsBlock(): string
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
            return '  <!-- TavlaTV dynamic news:start -->\n  <!-- No published news -->\n  <!-- TavlaTV dynamic news:end -->';
        }

        return "  <!-- TavlaTV dynamic news:start -->\n".implode("\n", $urls)."\n  <!-- TavlaTV dynamic news:end -->";
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
