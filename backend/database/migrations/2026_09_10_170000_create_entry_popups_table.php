<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Siteye ILK girildiginde ekran ortasinda gosterilen KARE reklam pop-up'i ("Giris Kare Banner").
// Kare gorsel + (opsiyonel) mobil gorsel + hedef link tutar. Gosterim sikligi ve hedef kitle
// panelden secilir. Yayindaki ilk kayit (sort,id) gosterilir; frontend localStorage ile gate'ler.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entry_popups', function (Blueprint $table) {
            $table->id();
            $table->string('image', 500)->nullable();        // kare gorsel (onerilen 600x600)
            $table->string('image_mobile', 500)->nullable(); // opsiyonel mobil gorsel — yoksa masaustu kucultulur
            $table->string('link', 500)->nullable();          // tiklaninca gidilecek URL — opsiyonel
            $table->string('frequency', 10)->default('session'); // session | daily | always
            $table->string('audience', 10)->default('all');      // all | guest | member
            $table->unsignedInteger('sort')->default(0);      // birden fazla varsa kucuk sayi once
            $table->boolean('published')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entry_popups');
    }
};
