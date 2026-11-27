<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Efektif rütbe (rating + PR + EP) ÖNBELLEĞİ. Yeni sistem AÇIKken her oyuncunun
 * gösterilen rütbe anahtarı (div.*) burada tutulur -> liderlik/profil tek kolondan okur,
 * her satır için PR/EP yeniden hesaplanmaz. KAPALIyken null (frontend rating'e düşer).
 * Analiz tamamlanınca (CareerPrService::recalc) ve toplu `rank:refresh` ile güncellenir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('rank_key', 16)->nullable()->after('rating');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('rank_key');
        });
    }
};
