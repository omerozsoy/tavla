<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// CANLI TURNUVA SİSTEMİ — dernek/grup erişimi: admin "isim + şifre" tanımlar; o şifreyle giren
// grup, /canli-turnuva-sistemi sayfasındaki formdan turnuva kurabilir. join_password gibi DÜZ METİN
// (admin paylaşsın/görsün diye). active=false -> giriş kapalı.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournament_accesses', function (Blueprint $t) {
            $t->id();
            $t->string('name');                 // dernek/grup adı (giriş yapanın kim olduğu)
            $t->string('password', 60);         // paylaşılan şifre (düz metin)
            $t->boolean('active')->default(true);
            $t->unsignedInteger('created_count')->default(0); // bu erişimle kurulan turnuva sayısı
            $t->timestamp('last_used_at')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournament_accesses');
    }
};
