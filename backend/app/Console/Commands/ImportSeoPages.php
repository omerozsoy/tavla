<?php

namespace App\Console\Commands;

use App\Models\InfoPage;
use Illuminate\Console\Command;

/**
 * SEO icerik sayfalarini (landing'ler + nasil-oynanir + turnuva kurallari + rehber
 * yazilari) commit'li JSON'dan InfoPage kayitlari olarak ice aktarir. Bu sayfalar
 * boylece /admin/bilgi-sayfalari'nda RichEditor ile duzenlenebilir hale gelir.
 *
 * IDEMPOTENT + ADMIN-DOSTU: her slug icin firstOrCreate kullanilir -> VAR OLANI EZMEZ.
 * Yani admin panelden yapilan duzenlemeler, deploy'da komut tekrar calissa bile korunur.
 * Yalnizca eksik (henuz olusturulmamis) slug'lar seed edilir.
 *
 * JSON src/data (guides.ts + tournamentRules.ts) + landing/kural metinlerinden
 * `node scripts/gen-seo-pages.mjs` (tsx) ile uretilir.
 *
 * Kullanim:  php artisan seo-pages:import --file=database/data/seo-pages.json
 *            php artisan seo-pages:import --file=... --dry
 */
class ImportSeoPages extends Command
{
    protected $signature = 'seo-pages:import
        {--file=database/data/seo-pages.json : Iceri aktarilacak JSON dosyasi}
        {--dry : Yazmadan neyin eklenecegini/atlanacagini goster}';

    protected $description = 'SEO icerik sayfalarini JSON\'dan InfoPage olarak seed eder (firstOrCreate; var olani ezmez)';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $file = (string) $this->option('file');

        $path = $this->resolveFile($file);
        if ($path === null) {
            $this->error("JSON dosyasi bulunamadi: {$file}");
            return self::FAILURE;
        }
        $this->info("Yerel dosyadan yukleniyor: {$path}");

        $data = json_decode((string) file_get_contents($path), true);
        if (! is_array($data) || empty($data)) {
            $this->warn('JSON bos veya gecersiz.');
            return self::FAILURE;
        }

        // Yalnizca taninan SEO slug'larini isle (guvenlik: rastgele slug seed etme).
        $allowed = InfoPage::SEO_SLUGS;

        $created = 0;
        $skipped = 0;
        foreach ($data as $row) {
            $slug = trim((string) ($row['slug'] ?? ''));
            if ($slug === '' || ! in_array($slug, $allowed, true)) {
                $this->warn("   ! atlaniyor (taninmayan slug): {$slug}");
                continue;
            }

            $exists = InfoPage::where('slug', $slug)->exists();
            if ($exists) {
                $this->line("   = var (korunuyor): {$slug}");
                $skipped++;
                continue;
            }

            $this->line(sprintf('   + eklenecek: %-48s body=%d krk', $slug, mb_strlen((string) ($row['body'] ?? ''))));
            if ($dry) {
                continue;
            }

            // firstOrCreate: var olani EZMEZ (admin duzenlemeleri korunur; idempotent).
            InfoPage::firstOrCreate(
                ['slug' => $slug],
                [
                    'title' => (string) ($row['title'] ?? $slug),
                    'seo_title' => isset($row['seo_title']) ? (string) $row['seo_title'] : null,
                    'seo_description' => isset($row['seo_description']) ? (string) $row['seo_description'] : null,
                    'body' => (string) ($row['body'] ?? ''),
                    'published' => true,
                    'sort' => (int) ($row['sort'] ?? 0),
                ],
            );
            $created++;
        }

        if ($dry) {
            $this->comment('Kuru calisma (--dry): hicbir sey yazilmadi.');
        } else {
            $this->info("Tamam: {$created} yeni eklendi, {$skipped} var olan korundu.");
        }
        return self::SUCCESS;
    }

    /** --file degerini gercek yola cevirir (ImportNews ile ayni sablon). */
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
}
