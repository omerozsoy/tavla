<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Online macta iki oyuncunun match_results satirlarini eslestirmek icin room_code.
 * Sunucu-otoriter PR: her oyuncunun PR'i KENDI log'undan hesaplanir; sonuc ekrani
 * iki oyuncuya da AYNI kanonik cifti (her iki satirin pr'i) bu koddan okur.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->string('room_code', 20)->nullable()->index()->after('opponent_name');
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn('room_code');
        });
    }
};
