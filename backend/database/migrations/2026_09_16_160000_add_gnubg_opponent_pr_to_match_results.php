<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * pvb (AI) maçında rakip=BOT'un gnubg-otoriter PR'ı. Online'da rakibin PR'ı karşı satırdan (kendi
 * gnubg_pr'ı) okunur; pvb'de karşı satır YOK -> bu kolonlar botun gnubg PR'ını satırın kendisinde
 * tutar (gnubg_pr = insan/satır sahibi ile simetrik). Böylece sonuç ekranında bot PR'ı da "yalnız
 * gnubg" direktifine uygun gösterilir (wildbg opponent_pr artık ekranda kullanılmaz). Nullable ->
 * eski/analiz-yok kayıtlar etkilenmez.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->float('gnubg_opponent_pr')->nullable()->after('gnubg_cube_pr');
            $table->float('gnubg_opponent_checker_pr')->nullable()->after('gnubg_opponent_pr');
            $table->float('gnubg_opponent_cube_pr')->nullable()->after('gnubg_opponent_checker_pr');
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['gnubg_opponent_pr', 'gnubg_opponent_checker_pr', 'gnubg_opponent_cube_pr']);
        });
    }
};
