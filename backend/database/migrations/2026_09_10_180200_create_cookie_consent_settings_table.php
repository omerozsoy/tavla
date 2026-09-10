<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Cerez onay banner'i + tercih modali metinleri (tek satirlik ayar). Admin panelden
// duzenlenir; frontend /api/cookie-consent'ten ceker (yoksa gomulu TR varsayilanlar).
// consent_version: artirilirsa TUM kullanicilardan yeniden onay istenir. ga_id/gtm_id/
// meta_pixel_id: doluysa VE kullanici ilgili kategoriye onay verdiyse script yuklenir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cookie_consent_settings', function (Blueprint $table) {
            $table->id();
            $table->string('banner_title', 160)->nullable();
            $table->text('banner_body')->nullable();
            $table->string('modal_title', 160)->nullable();
            $table->text('modal_desc')->nullable();
            $table->text('desc_necessary')->nullable();
            $table->text('desc_functional')->nullable();
            $table->text('desc_analytics')->nullable();
            $table->text('desc_marketing')->nullable();
            $table->unsignedInteger('consent_version')->default(1);
            $table->string('ga_id', 40)->nullable();          // Google Analytics (G-XXXX) — analitik
            $table->string('gtm_id', 40)->nullable();         // Google Tag Manager (GTM-XXXX) — analitik/pazarlama
            $table->string('meta_pixel_id', 40)->nullable();  // Meta Pixel — pazarlama
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cookie_consent_settings');
    }
};
