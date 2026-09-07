<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

// Test icin 10 ornek urun (Tavla/zar/kitap/zar kulesi). Idempotent: slug ile updateOrCreate.
// Fiyatlar: money_price KURUS (TL x100), coin_price jeton. Renk = gorsel varyant.
// Gorsel yok (images bos) -> kart ikon fallback gosterir; panelden gorsel eklenebilir.
class ProductSeeder extends Seeder
{
    public function run(): void
    {
        // [slug, name, category, payment_type, money(TL kurus)|null, coin|null, stock, colors[], description]
        $items = [
            ['ceviz-tavla', 'El Yapımı Ceviz Tavla', 'tavla', 'both', 149900, 1200, 12,
                [['name' => 'Ceviz', 'hex' => '#5a3a22'], ['name' => 'Koyu Meşe', 'hex' => '#3b2a1a']],
                'Usta işçiliğiyle sedef kakmalı, katlanır ahşap tavla.'],
            ['zeytin-tavla', 'Zeytin Ağacı Tavla', 'tavla', 'money', 199900, null, 6,
                [['name' => 'Doğal', 'hex' => '#8a7a4e']],
                'Doğal zeytin ağacından, her deseni benzersiz premium tavla.'],
            ['baslangic-tavla', 'Başlangıç Tavlası', 'tavla', 'coin', null, 600, 30,
                [['name' => 'Kırmızı', 'hex' => '#b03a2e'], ['name' => 'Mavi', 'hex' => '#2e5aa0'], ['name' => 'Yeşil', 'hex' => '#2e7d46']],
                'Yeni başlayanlar için hafif ve dayanıklı tavla.'],
            ['turnuva-zarlari', 'Turnuva Zarları (Hassas)', 'zar', 'both', 29900, 350, 40,
                [['name' => 'Beyaz', 'hex' => '#f2f2f2'], ['name' => 'Siyah', 'hex' => '#1a1a1a'], ['name' => 'Kehribar', 'hex' => '#d98a2b']],
                'Hassas kesim, keskin köşeli turnuva standardı zar seti (2 adet).'],
            ['deri-zar-bardagi', 'Deri Zar Bardağı', 'zar', 'both', 39900, 500, 25,
                [['name' => 'Bordo', 'hex' => '#6e2029'], ['name' => 'Kahve', 'hex' => '#4a3222'], ['name' => 'Siyah', 'hex' => '#1a1a1a']],
                'İç astarı keçe kaplı, sesi yumuşatan hakiki deri zar bardağı.'],
            ['ahsap-zar-kulesi', 'Ahşap Zar Kulesi', 'zar_kulesi', 'both', 44900, 550, 18,
                [['name' => 'Ceviz', 'hex' => '#5a3a22'], ['name' => 'Naturel', 'hex' => '#c8a97e']],
                'Adil zar için basamaklı ahşap zar kulesi; turnuvalarda tercih edilir.'],
            ['akrilik-zar-kulesi', 'Şeffaf Akrilik Zar Kulesi', 'zar_kulesi', 'money', 34900, null, 20,
                [['name' => 'Şeffaf', 'hex' => '#dfeaf2']],
                'Modern görünümlü, dağılmayı sağlayan şeffaf akrilik zar kulesi.'],
            ['tavla-strateji-kitabi', 'Modern Tavla Stratejisi', 'kitap', 'both', 24900, 300, 50,
                [],
                'Açılışlardan küp kullanımına kapsamlı Türkçe strateji rehberi.'],
            ['tavla-acilislar-kitabi', 'Açılışlar ve İlk Hamleler', 'kitap', 'coin', null, 250, 50,
                [],
                'En iyi açılış hamleleri ve yanıtları; örnek pozisyonlarla.'],
            ['hediyelik-set', 'Tavla + Zar + Kule Hediye Seti', 'diger', 'both', 249900, 2000, 8,
                [['name' => 'Ceviz', 'hex' => '#5a3a22'], ['name' => 'Siyah', 'hex' => '#1a1a1a']],
                'Tavla, turnuva zarları ve zar kulesini bir arada sunan hediye seti.'],
        ];

        $sort = 0;
        foreach ($items as [$slug, $name, $cat, $pay, $money, $coin, $stock, $colors, $desc]) {
            Product::updateOrCreate(['slug' => $slug], [
                'name'         => $name,
                'category'     => $cat,
                'description'  => $desc,
                'images'       => [],
                'colors'       => $colors,
                'payment_type' => $pay,
                'money_price'  => $money,
                'coin_price'   => $coin,
                'stock'        => $stock,
                'published'    => true,
                'sort'         => $sort++,
            ]);
        }
    }
}
