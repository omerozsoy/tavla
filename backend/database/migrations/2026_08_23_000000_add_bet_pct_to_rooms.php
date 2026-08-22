<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            // Mac Oyunu: bahis = bakiyenin %'si (10/30/50/100). Eslesme bu kategoriyle,
            // coin transferi iki oyuncunun bahsinin min'i olarak hesaplanir. 0 = pct bahis yok.
            $table->unsignedTinyInteger('bet_pct')->default(0)->after('stake');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('bet_pct');
        });
    }
};
