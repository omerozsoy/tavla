<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

// 10 renkli zar ürünü (kartları public/uploads/urunler/zar-*.png). Idempotent: slug ile
// updateOrCreate. Her renk AYRI ürün (görsel = o rengin kartı). Kategori: Zar.
class DiceProductSeeder extends Seeder
{
    public function run(): void
    {
        $zar = ProductCategory::firstOrCreate(['slug' => 'zar'], ['name' => 'Zar', 'sort' => 1]);

        // [slug-color, renk adı, hex, görsel dosyası]
        $colors = [
            ['kirmizi', 'Kırmızı', '#d13b30', 'zar-01-kirmizi.png'],
            ['turuncu', 'Turuncu', '#e8702a', 'zar-02-turuncu.png'],
            ['amber', 'Amber', '#f0a020', 'zar-03-amber.png'],
            ['sari', 'Sarı', '#f2cf1f', 'zar-04-sari.png'],
            ['yesil', 'Yeşil', '#4caf50', 'zar-05-yesil.png'],
            ['zumrut', 'Zümrüt', '#1faa6e', 'zar-06-zumrut.png'],
            ['turkuaz', 'Turkuaz', '#1fb6c4', 'zar-07-turkuaz.png'],
            ['mavi', 'Mavi', '#2f6fd0', 'zar-08-mavi.png'],
            ['mor', 'Mor', '#7d3fc0', 'zar-09-mor.png'],
            ['fusya', 'Fuşya', '#d6318f', 'zar-10-fusya.png'],
        ];

        $sort = 0;
        foreach ($colors as [$key, $renk, $hex, $file]) {
            Product::updateOrCreate(['slug' => 'zar-'.$key], [
                'name'         => 'Turnuva Zarı — '.$renk,
                'category_id'  => $zar->id,
                'description'  => $renk.' renkli, hassas kesim turnuva standardı zar seti (2 adet).',
                'images'       => ['urunler/'.$file],
                'colors'       => [['name' => $renk, 'hex' => $hex]],
                'payment_type' => 'both',
                'money_price'  => 14990, // 149,90 TL (kuruş)
                'coin_price'   => 300,
                'stock'        => 60,
                'published'    => true,
                'sort'         => 10 + $sort++, // örnek ürünlerden sonra
            ]);
        }
    }
}
