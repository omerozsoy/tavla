<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 3.'LÜK (3-4) MAÇI oynatılsın mı? Açık (varsayılan): yarı final kaybedenleri 3.'lük maçı oynar.
// Kapalı: 3.'lük maçı hiç kurulmaz, finale direkt geçilir; 3./4. yarı final kaybedenlerinden
// rating'e göre belirlenir (standingsFromBracket zaten böyle sıralar).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            $t->boolean('third_place_match')->default(true)->after('final_minutes');
        });
        Schema::table('tournament_schedules', function (Blueprint $t) {
            $t->boolean('third_place_match')->default(true)->after('final_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', fn (Blueprint $t) => $t->dropColumn('third_place_match'));
        Schema::table('tournament_schedules', fn (Blueprint $t) => $t->dropColumn('third_place_match'));
    }
};
