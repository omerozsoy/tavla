<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Canlı maç İZLEYİCİLERİ (spectator presence). Her izleyici heartbeat'te (POST /rooms/{code}/watch)
// upsert edilir; bayat (>15sn görünmeyen) kayıtlar temizlenir. İzleyici sayısı + isimleri buradan.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_viewers', function (Blueprint $table) {
            $table->id();
            $table->string('room_code', 8)->index();
            $table->string('token', 64); // izleyici cihaz kimliği (playerToken) — dedup
            $table->unsignedBigInteger('user_id')->nullable(); // giriş yapmışsa avatar/çerçeve lookup
            $table->string('name', 60);
            $table->double('last_seen'); // microtime(true)
            $table->timestamps();
            $table->unique(['room_code', 'token']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_viewers');
    }
};
