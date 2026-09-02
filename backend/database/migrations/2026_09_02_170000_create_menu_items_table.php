<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sol menu duzenleme (sira + ad + gorunurluk). Her satir frontend pages.ts'teki bir
 * menu anahtarina (key) karsilik gelir. label_* NULL ise frontend i18n cevirisini
 * kullanir; admin Turkce ad girince (label_tr) diger diller otomatik cevrilip saklanir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menu_items', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // pages.ts key ile eslesir
            $table->string('label_tr')->nullable();
            $table->string('label_en')->nullable();
            $table->string('label_es')->nullable();
            $table->string('label_de')->nullable();
            $table->string('label_fr')->nullable();
            $table->unsignedInteger('sort')->default(0); // kucuk sayi ustte
            $table->boolean('visible')->default(true);   // menude goster/gizle
            $table->string('group')->nullable();         // divider gruplamasi (pages.ts group)
            $table->timestamps();
        });

        // Katalogu (config/menu.php) ilk kez tohumla — mevcut sirayi birebir korur.
        \App\Models\MenuItem::syncCatalog();
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_items');
    }
};
