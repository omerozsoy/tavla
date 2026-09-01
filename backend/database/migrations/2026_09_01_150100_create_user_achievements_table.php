<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * user_achievements — kazanilan basarimlar (unlock kayitlari).
 * Katalog (tanim) config/achievements.php'de; burada yalnizca KULLANICI x SLUG unlock'u.
 * unique(user_id, achievement_slug) -> ayni rozet iki kez verilemez (idempotency + coin odul guvenligi).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_achievements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('achievement_slug', 48);
            $table->timestamp('unlocked_at')->nullable();
            $table->unsignedBigInteger('progress')->default(0); // unlock anindaki metrik degeri (goruntuleme)
            $table->unsignedInteger('reward_coin')->default(0); // verilen coin odulu (idempotent -> tek kez)
            $table->boolean('notified')->default(false);        // unlock animasyonu gosterildi mi

            $table->timestamps();

            $table->unique(['user_id', 'achievement_slug']);
            $table->index('achievement_slug'); // rarity: slug basina unlock sayimi hizli
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_achievements');
    }
};
