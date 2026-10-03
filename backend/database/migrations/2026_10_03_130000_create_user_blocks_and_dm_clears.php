<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// DM gelen kutusu kebab menüsü: (1) kullanıcı BLOKLAMA (iki yönlü mesaj engeli),
// (2) "Sohbeti sil" = KULLANICIYA ÖZEL gizleme (dm_clears.cleared_at'tan ESKİ mesajlar
// o kullanıcıya görünmez; karşı taraf etkilenmez, yeni mesaj gelince sohbet geri döner).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('blocked_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['blocker_id', 'blocked_id']); // tek blok satırı (idempotent)
            $table->index('blocked_id'); // "beni kim blokladı" sorgusu
        });

        Schema::create('dm_clears', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();   // silen kişi
            $table->foreignId('peer_id')->constrained('users')->cascadeOnDelete();   // karşı taraf
            // Bu ID'ye KADAR (<=) olan mesajlar user_id'ye gizli. ID kullanırız (timestamp saniye
            // hassasiyeti aynı-saniye yeni mesajı yanlışlıkla gizleyebilir); yeni mesaj = daha büyük ID.
            $table->unsignedBigInteger('cleared_msg_id')->default(0);
            $table->unique(['user_id', 'peer_id']); // sohbet başına tek kayıt (upsert)
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dm_clears');
        Schema::dropIfExists('user_blocks');
    }
};
