<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            // Bahisli oyun sonucu: her oyuncunun beyan ettigi sonuc ('won'|'lost').
            // Coin transferi ancak iki tarafli mutabakat VEYA yetkili senkron mac
            // durumu kazanani belirlerse yapilir (tek tarafli beyanla odeme yok).
            $table->string('p1_result', 8)->nullable()->after('settled');
            $table->string('p2_result', 8)->nullable()->after('p1_result');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['p1_result', 'p2_result']);
        });
    }
};
