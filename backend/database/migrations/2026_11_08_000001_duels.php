<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bireysel Düello modülü. Düello = puansız arkadaş-maçı (mode='friendly' + unrated=true)
 * ÜSTÜNE eklenen duel=true bayrağı. Rating'e dokunmaz; yalnız bireysel düello galibiyeti
 * (duels tablosu) biriktirir. Davet akışı game_invites üstünden gider (ayrı endpoint yok).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Davet + oda: bu maç bir düello mu? (default 0 = normal arkadaş/eşleşme maçı — mevcut akış).
        Schema::table('game_invites', function (Blueprint $table) {
            $table->boolean('duel')->default(false)->after('bet_pct');
        });
        Schema::table('rooms', function (Blueprint $table) {
            $table->boolean('duel')->default(false)->after('unrated');
        });

        // Düello sonuçları: oda başına TEK satır (room_code UNIQUE -> idempotent kayıt). winner_id
        // NULL = henüz/belirsiz (yazılmaz; yalnız kesin kazananla dolar). Bireysel + takım sıralaması
        // buradan COUNT(winner_id) ile türetilir.
        Schema::create('duels', function (Blueprint $table) {
            $table->id();
            $table->string('room_code', 12)->unique();
            $table->unsignedBigInteger('player1_id');
            $table->unsignedBigInteger('player2_id');
            $table->unsignedBigInteger('winner_id')->nullable()->index();
            $table->unsignedTinyInteger('target_points'); // 1 | 3 | 5
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('duels');
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('duel');
        });
        Schema::table('game_invites', function (Blueprint $table) {
            $table->dropColumn('duel');
        });
    }
};
