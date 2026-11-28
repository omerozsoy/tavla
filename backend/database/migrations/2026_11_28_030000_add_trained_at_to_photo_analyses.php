<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// "Eğitime Gönder": eğitime hazır (review_status != null) etiketli kayıtlar belli bir limite
// gelince admin tek tıkla eğitim setine gönderir; gönderilenler trained_at ile işaretlenir
// (tekrar gönderilmez, ilerleme görünür).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photo_analyses', function (Blueprint $table) {
            $table->timestamp('trained_at')->nullable()->index(); // eğitim setine gönderildi
        });
    }

    public function down(): void
    {
        Schema::table('photo_analyses', function (Blueprint $table) {
            $table->dropColumn('trained_at');
        });
    }
};
