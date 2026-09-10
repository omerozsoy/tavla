<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Hukuki/yasal sayfalar (KVKK, Gizlilik, Cerez Politikasi, Kullanim Kosullari, Uyelik
// Sozlesmesi). Admin panelden (Filament LegalPageResource) duzenlenir; frontend icerigi
// veritabanindan ceker (/api/legal-pages/<slug>). Rich-text (HTML) govde + SEO alanlari.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legal_pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique();       // kvkk | gizlilik-politikasi | cerez-politikasi | ...
            $table->string('title', 160);
            $table->string('seo_title', 160)->nullable();
            $table->string('seo_description', 320)->nullable();
            $table->longText('body')->nullable();        // RichEditor HTML
            $table->boolean('active')->default(true);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legal_pages');
    }
};
