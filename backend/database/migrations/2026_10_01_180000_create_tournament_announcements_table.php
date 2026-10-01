<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Turnuva duyurulari: admin panelden ("Turnuva Duyuru") girilir, turnuva lobisinde
// (detay sayfasi) oyunculara gosterilir. Yeni duyuru gelince istemci zil sesi calar.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournament_announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained('tournaments')->cascadeOnDelete();
            $table->text('message');
            $table->timestamps();
            $table->index('tournament_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournament_announcements');
    }
};
