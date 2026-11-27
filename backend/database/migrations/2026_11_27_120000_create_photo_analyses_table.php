<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fotograftan Pozisyon Analizi: yuklenen foto -> tanima -> gnubg hint kaydi.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('photo_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('image_path');                 // local disk (private) yolu
            $table->string('status')->default('pending')->index(); // pending|done|invalid|failed
            $table->boolean('flip')->default(false);
            $table->json('position')->nullable();          // yapisal konum {points,bar,turn,dice,cube}
            $table->json('hint')->nullable();              // gnubg analyze sonucu
            $table->json('debug')->nullable();             // tanima debug (board_conf, checkers, valid...)
            $table->boolean('valid')->default(false);      // tanima oz-denetim gecti mi
            $table->string('error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('photo_analyses');
    }
};
