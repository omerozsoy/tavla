<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Açılış pratiği havuzu: motor-doğrulanmış açılış pozisyonları (board+zar başına TEK temsilci,
// skor bağlamları birleştirilmiş). xgid UNIQUE = aynı dizilim asla iki kez. /api/opening-positions
// band'e göre sayfalı sunar; frontend lazy çeker (bundle'a gömülü DEĞİL). `openings:import` doldurur.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opening_positions', function (Blueprint $table) {
            $table->id();
            $table->string('band', 12)->index();   // cok_kolay | kolay | orta | zor | cok_zor
            $table->string('dice', 2);
            $table->string('xgid', 80)->unique();  // benzersiz dizilim güvencesi (DB seviyesi)
            $table->string('answer', 60);          // otoriter en iyi hamle (gnubg)
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opening_positions');
    }
};
