<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Cerez Politikasi'ndaki "Kullanilan Cerezler" tablosu. Her satir bir cerez/benzeri
// teknoloji: ad, saglayici, amac, kategori, sure. Admin panelden duzenlenir; frontend
// Cerez Politikasi sayfasinda canli tablo olarak gosterir (/api/cookies).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cookie_entries', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);                 // ornek: tavla.token
            $table->string('provider', 120)->nullable(); // ornek: Birinci taraf (site) / Google
            $table->string('purpose', 400)->nullable();   // amac aciklamasi
            $table->string('category', 20)->default('necessary'); // necessary|functional|analytics|marketing
            $table->string('duration', 80)->nullable();   // ornek: Kalici / Oturum / 1 yil
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cookie_entries');
    }
};
