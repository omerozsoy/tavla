<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fiziksel magaza urunleri (Tavla, zar, kitap, zar kulesi vb.). Panelden yonetilir.
// Odeme tipi urun bazinda: coin | money (TL/Garanti) | both. Renk opsiyonu YALNIZCA gorsel
// varyant (ayni stok/fiyat) -> colors JSON [{name, hex}]. Fiyatlar: coin_price jeton,
// money_price KURUS (banka birimi; TL x 100). Stok tek sayac (renkten bagimsiz).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');                          // urun adi (Turkce)
            $table->string('slug')->unique();                // URL/anahtar
            $table->string('category', 40)->default('diger'); // tavla | zar | kitap | zar_kulesi | diger
            $table->text('description')->nullable();
            $table->json('images')->nullable();              // galeri: dosya adlari (disk 'uploads')
            $table->json('colors')->nullable();              // [{name, hex}] — gorsel varyant
            $table->string('payment_type', 10)->default('money'); // coin | money | both
            $table->unsignedInteger('coin_price')->nullable();     // jeton (coin/both)
            $table->unsignedInteger('money_price')->nullable();    // KURUS (money/both)
            $table->unsignedInteger('stock')->default(0);
            $table->boolean('published')->default(true);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
