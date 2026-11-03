<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Üyelere özel sohbet + sabitlenebilir duyurular (üyelik bitince erişim kalkar — API gate).
        Schema::create('team_messages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('team_id')->index();
            $table->unsignedBigInteger('user_id')->nullable(); // null = sistem mesajı
            $table->text('body');
            $table->boolean('pinned')->default(false);
            $table->timestamps();
            $table->index(['team_id', 'pinned']);
        });

        // Kalıcı kupalar + şampiyon rozetleri. Ödül dağıtımı idempotent (mükerrer kupa üretmez — §10).
        Schema::create('team_awards', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('team_id')->index();
            $table->string('month_key', 7); // YYYY-MM
            $table->unsignedTinyInteger('rank'); // 1-3
            $table->string('kind', 16);          // cup | champion_badge
            $table->timestamp('created_at')->nullable();
            $table->unique(['team_id', 'month_key', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_awards');
        Schema::dropIfExists('team_messages');
    }
};
