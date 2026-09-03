<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Arkadaslar arasi ozel mesajlasma (DM). Her satir tek bir mesaj.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->timestamp('read_at')->nullable(); // alici okuyunca dolar
            $table->timestamp('created_at')->nullable();
            // Konusma cekme: iki kullanici arasindaki mesajlar (her iki yon)
            $table->index(['sender_id', 'receiver_id']);
            // Rozet: bana gelen okunmamislar
            $table->index(['receiver_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
