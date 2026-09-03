<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sunucu-otoriter MAÇ durumu (para maçı güvenliği Faz 3).
 * server_match: {target, score:{white,black}, gameNo, done, winner}. Oyun bitince sunucu
 * skoru KENDİ hesaplar (Backgammon::gamePoints); maç bitince winner set edilir.
 * settle/reportRating bunu (istemci skoruna DEĞİL) kaynak alır -> skor forge edilemez.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->json('server_match')->nullable()->after('server_winner');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('server_match');
        });
    }
};
