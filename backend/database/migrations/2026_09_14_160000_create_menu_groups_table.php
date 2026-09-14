<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sol menu GRUP basliklari (admin-yonetimli). Her grup: anahtar + gorunen ad (label_tr,
// digerleri otomatik ceviri) + sira + gorunurluk. menu_items.group bir gruba baglanir.
// Bos label_tr -> frontend i18n varsayilanina duser (bilinen 7 grup icin).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menu_groups', function (Blueprint $table) {
            $table->id();
            $table->string('key', 40)->unique();
            $table->string('label_tr', 80)->nullable();
            $table->string('label_en', 80)->nullable();
            $table->string('label_es', 80)->nullable();
            $table->string('label_de', 80)->nullable();
            $table->string('label_fr', 80)->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('visible')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_groups');
    }
};
