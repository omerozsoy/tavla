<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// pvb (AI) maçında rakip=BOT'un gnubg NATIVE MWC-luck'ı (Luck V1). Online'da rakip luck_mwc'si
// karşı satırdan okunur; pvb'de karşı satır yok -> bu kolon botun gnubg şansını satırın kendisinde
// tutar (opponent_luck ham-luck ile simetrik).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->float('opponent_luck_mwc')->nullable()->after('opponent_luck');
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn('opponent_luck_mwc');
        });
    }
};
