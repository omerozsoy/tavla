<?php

use App\Models\MenuItem;
use Illuminate\Database\Migrations\Migration;

/**
 * Sol menü (admin /admin/menu-items) SIRALAMASINI site ile eşitle + eksik sayfaları ekle.
 *
 * SORUN: menu_items tablosu eski bir tohumdan kalmış; bazı sayfalar (Mat Analiz/matAnalyzer,
 * Mesajlar, Şans Çarkı, Zar Slotu, Bahane Makinesi, Bilgi alt sayfaları) admin listesinde YOK
 * ve sıra site menüsüyle (config/menu.php = src/pages.ts) uyuşmuyor. syncCatalog() eksikleri
 * yalnızca SONA eklediğinden (++maxSort) sıra düzelmiyor — bu yüzden tek seferlik data-migration.
 *
 * YAPILAN: her katalog anahtarı için satır olsun; sort = katalog sırası (0..N), group = katalog
 * grubu. Mevcut satırların ETİKET override'ı (label_tr/en/...) ve görünürlüğü (visible) KORUNUR;
 * yalnız sort+group kanonik sıraya çekilir. Katalogda olmayan bayat anahtarlar (ör. eski 'info')
 * silinir. Böylece admin listesi = site menüsü dizilimi.
 */
return new class extends Migration
{
    public function up(): void
    {
        // config CACHE'li olabilir (deploy'da migrate, optimize:clear'dan ÖNCE koşar) -> dosyayı
        // DOĞRUDAN oku ki taze katalog (yeni 'matAnalyzer') görülsün.
        $catalog = require config_path('menu.php');
        $items = $catalog['items'] ?? [];
        $keys = [];
        foreach ($items as $i => $item) {
            $key = $item['key'] ?? null;
            if (! $key) {
                continue;
            }
            $keys[] = $key;
            $m = MenuItem::firstOrNew(['key' => $key]);
            $m->sort = $i;                       // kanonik sıra (katalog = pages.ts)
            $m->group = $item['group'] ?? null;  // kanonik grup
            if (! $m->exists) {
                $m->visible = true;              // yeni sayfa varsayılan görünür
            }
            $m->save();
        }

        // Katalogda olmayan bayat anahtarları temizle (site menüsünde zaten görünmüyorlar).
        if ($keys) {
            MenuItem::whereNotIn('key', $keys)->delete();
        }
    }

    public function down(): void
    {
        // Veri düzeltmesi; geri alınmaz (no-op).
    }
};
