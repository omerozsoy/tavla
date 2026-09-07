<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Panelden yonetilen urun kategorileri (Tavla, Zar, Kitap, Zar Kulesi, Diger...).
// slug = urundeki eski string kategori anahtariyla ESLESIR (backfill icin). Varsayilan
// 5 kategori burada olusturulur -> deploy'da migrate ile otomatik gelir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('published')->default(true);
            $table->timestamps();
        });

        // Mevcut sabit kategoriler (eski enum) -> tohum. slug eski anahtarla ayni.
        $defaults = [
            ['slug' => 'tavla', 'name' => 'Tavla'],
            ['slug' => 'zar', 'name' => 'Zar'],
            ['slug' => 'kitap', 'name' => 'Kitap'],
            ['slug' => 'zar_kulesi', 'name' => 'Zar Kulesi'],
            ['slug' => 'diger', 'name' => 'Diğer'],
        ];
        $now = now();
        foreach ($defaults as $i => $d) {
            DB::table('product_categories')->insert([
                'slug'       => $d['slug'],
                'name'       => $d['name'],
                'sort'       => $i,
                'published'  => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_categories');
    }
};
