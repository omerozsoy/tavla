<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Database\Seeder;

// 10 demo tavla kitabı (kapaklar public/uploads/urunler/kitap-*.png). Idempotent: slug ile
// updateOrCreate. Kategori: Kitap. Ödeme: coin + para (both).
class BookProductSeeder extends Seeder
{
    public function run(): void
    {
        // Eski görselsiz örnek kitapları kaldır (ProductSeeder'dan gelen 2 demo).
        Product::whereIn('slug', ['tavla-strateji-kitabi', 'tavla-acilislar-kitabi'])->delete();

        $cat = ProductCategory::firstOrCreate(['slug' => 'kitap'], ['name' => 'Kitap', 'sort' => 2]);

        // [slug-parça, ad, açıklama, görsel dosyası]
        $books = [
            ['tavlanin-ilkeleri', 'Tavlanın İlkeleri', 'Temel kurallar, strateji ve doğru zihniyetle tavlaya sağlam bir başlangıç.', 'kitap-01-tavlanin-ilkeleri.png'],
            ['acilis-hamleleri', 'Açılış Hamleleri', 'Her açılış zarına en iyi cevaplar ve modern açılış teorisi.', 'kitap-02-acilis-hamleleri.png'],
            ['zar-ve-olasilik', 'Zar ve Olasılık', 'Zar dağılımları, vuruş olasılıkları ve risk hesabının matematiği.', 'kitap-03-zar-ve-olasilik.png'],
            ['blokaj-ve-kapi-oyunu', 'Blokaj ve Kapı Oyunu', 'Prime kurma, rakibi hapsetme ve blokaj kırma teknikleri.', 'kitap-04-blokaj-ve-kapi-oyunu.png'],
            ['doubling-cube', 'Doubling Cube', 'Küp kullanımı; ikiye katlama, kabul ve ret kararlarının mantığı.', 'kitap-05-doubling-cube.png'],
            ['toplama-oyunu', 'Toplama Oyunu', 'Yarış pozisyonları, pip sayımı ve kusursuz bear-off tekniği.', 'kitap-06-toplama-oyunu.png'],
            ['turnuva-tavlasi', 'Turnuva Tavlası', 'Maç formatı, Crawford kuralı ve turnuva stratejisi.', 'kitap-07-turnuva-tavlasi.png'],
            ['masadaki-zihin', 'Masadaki Zihin', 'Psikoloji, konsantrasyon ve tilt yönetimiyle masada üstünlük.', 'kitap-08-masadaki-zihin.png'],
            ['tavlanin-uzun-yolu', 'Tavlanın Uzun Yolu', 'Tavlanın tarihi, kültürü ve efsanevi ustaların hikâyeleri.', 'kitap-09-tavlanin-uzun-yolu.png'],
            ['sinir-agi-cagi', 'Sinir Ağı Çağı', 'Yapay zekâ ve sinir ağlarıyla modern tavla analizi.', 'kitap-10-sinir-agi-cagi.png'],
        ];

        $sort = 0;
        foreach ($books as [$key, $ad, $aciklama, $file]) {
            Product::updateOrCreate(['slug' => 'kitap-'.$key], [
                'name'         => $ad,
                'category_id'  => $cat->id,
                'description'  => $aciklama,
                'images'       => ['urunler/'.$file],
                'colors'       => [],
                'payment_type' => 'both',
                'money_price'  => 24990, // 249,90 TL (kuruş)
                'coin_price'   => 500,
                'stock'        => 100,
                'published'    => true,
                'sort'         => 20 + $sort++, // zar (10+) ürünlerinden sonra
            ]);
        }
    }
}
