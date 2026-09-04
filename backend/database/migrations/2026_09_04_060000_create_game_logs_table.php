<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * game_logs: OYNANAN TÜM maçların hamle+zar kaydı (denetim/replay).
 *
 * Oyun tarayıcıda çalıştığı için kayıt istemci-taraflıdır: her istemci KENDİ turlarını
 * (zar + hamle notasyonu) kaydeder. Online'da iki oyuncu ayrı kolona yazar (p1_events /
 * p2_events, her kolon TEK yazar -> yarış yok); admin görünümü seq'e göre birleştirir.
 * pvb'de tek istemci hem insan hem botu p1_events'e yazar.
 *
 * uid: online = oda kodu (ortak), offline (pvb/local) = istemci üretir. Maç ID'si bu uid
 * olup oyun esnasında sol üstte gösterilir ve admin bu uid ile listeler.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_logs', function (Blueprint $table) {
            $table->id();
            $table->string('uid', 40)->unique();          // maç kimliği (oda kodu veya istemci üretimi)
            $table->string('mode', 16)->default('pvb');    // pvb | online | local
            $table->unsignedSmallInteger('target')->default(1); // maç uzunluğu (puan)
            $table->string('p1_name', 40)->nullable();
            $table->string('p2_name', 40)->nullable();
            $table->unsignedBigInteger('p1_user_id')->nullable();
            $table->unsignedBigInteger('p2_user_id')->nullable();
            $table->string('status', 12)->default('playing'); // playing | finished
            $table->string('winner', 8)->nullable();       // white | black (maç kazananı rengi)
            $table->json('score')->nullable();             // {white, black}
            // Turlar: [{g:gameNo, s:seq, p:'W'|'B', d:'6-5', m:'24/18 13/8'}] — her kolon tek yazar.
            $table->longText('p1_events')->nullable();
            $table->longText('p2_events')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_logs');
    }
};
