<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RÖVANŞ: biten odada iki taraf da "rövanş" derse sunucu AYNI AYARLARLA (uzunluk, bahis,
 * bet_pct, mod, tempo) yeni bir oda açar ve kodunu iki tarafa da bildirir.
 * rematch_p1/p2: null = cevap yok, 'yes' = istiyor, 'no' = reddetti.
 * rematch_code: anlaşma sağlanınca açılan YENİ odanın kodu (bir kez yazılır).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->string('rematch_p1', 4)->nullable();
            $table->string('rematch_p2', 4)->nullable();
            $table->string('rematch_code', 8)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['rematch_p1', 'rematch_p2', 'rematch_code']);
        });
    }
};
