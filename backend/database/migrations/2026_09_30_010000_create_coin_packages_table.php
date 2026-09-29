<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Coin (jeton) paketleri — "TL öde -> coin al". Panelden yonetilir (Magaza > Coin Paketleri).
// price KURUS (banka birimi, TL x100); coins verilen jeton. FIYAT SUNUCU-OTORITER: odemede
// PaymentController::coinSubtotal bu tablodan okur (frontend'ten gelen tutara guvenilmez).
// Baslangic tohumu config/garanti.php coin_packages ile BIREBIR (gecis oncesi degerler).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coin_packages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 40)->unique();          // kalici kimlik (baslangic/kese/...) — sepet + odeme
            $table->string('name', 60);                     // TR gosterim adi
            $table->unsignedInteger('price');               // KURUS (TL x100)
            $table->unsignedInteger('coins');               // verilen coin (gc)
            $table->unsignedTinyInteger('discount')->default(0); // gosterim % rozet (coin basi avantaj)
            $table->boolean('popular')->default(false);     // "EN POPULER" rozeti
            $table->boolean('published')->default(true);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        // Mevcut 6 paketi tohumla (config/garanti.php ile ayni). Idempotent: tablo yeni olusuyor.
        $now = now();
        $rows = [
            ['slug' => 'baslangic', 'name' => 'Başlangıç', 'price' => 10000,  'coins' => 100,   'discount' => 0,  'popular' => false, 'sort' => 1],
            ['slug' => 'kese',      'name' => 'Kese',      'price' => 47500,  'coins' => 500,   'discount' => 5,  'popular' => false, 'sort' => 2],
            ['slug' => 'sandik',    'name' => 'Sandık',    'price' => 90000,  'coins' => 1000,  'discount' => 10, 'popular' => false, 'sort' => 3],
            ['slug' => 'hazine',    'name' => 'Hazine',    'price' => 212500, 'coins' => 2500,  'discount' => 15, 'popular' => false, 'sort' => 4],
            ['slug' => 'kasa',      'name' => 'Kasa',      'price' => 400000, 'coins' => 5000,  'discount' => 20, 'popular' => true,  'sort' => 5],
            ['slug' => 'servet',    'name' => 'Servet',    'price' => 750000, 'coins' => 10000, 'discount' => 25, 'popular' => false, 'sort' => 6],
        ];
        foreach ($rows as $r) {
            DB::table('coin_packages')->insert($r + ['created_at' => $now, 'updated_at' => $now]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('coin_packages');
    }
};
