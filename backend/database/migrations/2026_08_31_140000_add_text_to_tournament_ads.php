<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Banner slider (Christie's tarzi): gorselin ustune bindirilen editoryal metin alanlari.
// Bos birakilirsa gorsel ciplak gosterilir (yazi gorselin icinde hazir gelmis demektir).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table) {
            $table->string('kicker', 80)->nullable()->after('image');   // ust etiket (küçük, büyük harf)
            $table->string('title', 160)->nullable()->after('kicker');  // büyük serif başlık
            $table->string('subtitle', 240)->nullable()->after('title'); // kısa alt cümle
            $table->string('cta', 60)->nullable()->after('subtitle');   // buton yazısı (ör. "Keşfet")
        });
    }

    public function down(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table) {
            $table->dropColumn(['kicker', 'title', 'subtitle', 'cta']);
        });
    }
};
