<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// gnubg JOKER sayısı (Rolls marked very lucky + very unlucky), per oyuncu. Maç Özeti'nde
// "Jokers" + "Luck (Equity)" gerçek gnubg verisinden gösterilir (luck_emg zaten mevcut).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->integer('luck_jokers')->nullable();
            $table->integer('opponent_luck_jokers')->nullable(); // pvb: bot/rakip jokerleri
            $table->float('opponent_luck_emg')->nullable();      // pvb: bot/rakip luck equity (cost)
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['luck_jokers', 'opponent_luck_jokers', 'opponent_luck_emg']);
        });
    }
};
