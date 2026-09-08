<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Database\Seeder;

// 10 premium tavla ürünü (kartları public/uploads/urunler/tavla-*.png). Idempotent: slug ile
// updateOrCreate. Her tema AYRI ürün (görsel = o temanın kartı). Kategori: Tavla.
class BoardProductSeeder extends Seeder
{
    public function run(): void
    {
        $cat = ProductCategory::firstOrCreate(['slug' => 'tavla'], ['name' => 'Tavla', 'sort' => 0]);

        // [slug, ürün adı, tema renk adı, hex, görsel dosyası]
        $boards = [
            ['blackpearl-gala',   'Black Pearl Gala',   'Siyah İnci', '#1b1b22', 'tavla-01-blackpearl-gala.png'],
            ['emerald-royal',     'Emerald Royal',      'Zümrüt',     '#0f6b4f', 'tavla-02-emerald-royal.png'],
            ['sapphire-club',     'Sapphire Club',      'Safir',      '#1d3f8a', 'tavla-03-sapphire-club.png'],
            ['amethyst-elite',    'Amethyst Elite',     'Ametist',    '#6b3fa0', 'tavla-04-amethyst-elite.png'],
            ['navy-prestige',     'Navy Prestige',      'Lacivert',   '#1f2d4a', 'tavla-05-navy-prestige.png'],
            ['bordeaux-classic',  'Bordeaux Classic',   'Bordo',      '#7a1f2b', 'tavla-06-bordeaux-classic.png'],
            ['ruby-master',       'Ruby Master',        'Yakut',      '#b01e37', 'tavla-07-ruby-master.png'],
            ['pistachio-sport',   'Pistachio Sport',    'Fıstık',     '#8bbf3f', 'tavla-08-pistachio-sport.png'],
            ['copper-heritage',   'Copper Heritage',    'Bakır',      '#b5642a', 'tavla-09-copper-heritage.png'],
            ['anthracite-pro',    'Anthracite Pro',     'Antrasit',   '#33373d', 'tavla-10-anthracite-pro.png'],
        ];

        $sort = 0;
        foreach ($boards as [$key, $name, $renk, $hex, $file]) {
            Product::updateOrCreate(['slug' => 'tavla-'.$key], [
                'name'         => $name,
                'category_id'  => $cat->id,
                'description'  => $name.' — el işçiliği premium tavla; sedef kakma detayları, '.$renk.' tonlarında kadife iç, hakiki pul ve zar seti dahil.',
                'images'       => ['urunler/'.$file],
                'colors'       => [['name' => $renk, 'hex' => $hex]],
                'payment_type' => 'both',
                'money_price'  => 189900, // 1.899,00 TL (kuruş)
                'coin_price'   => 4000,
                'stock'        => 25,
                'published'    => true,
                'sort'         => $sort++,
            ]);
        }
    }
}
