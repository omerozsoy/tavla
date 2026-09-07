<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lucky_wheel_rewards', function (Blueprint $table) {
            $table->id();
            $table->string('name');                        // Başlık (dilime yazılır)
            $table->string('description')->nullable();      // Açıklama (admin/gösterim)
            $table->string('type', 20)->default('COIN');    // COIN|PREMIUM_DAY|AVATAR|BOARD_THEME|BADGE|FREE_SPIN|CUSTOM
            $table->integer('amount')->default(0);          // COIN miktarı / gün / free spin adedi
            $table->string('reference_id')->nullable();     // AVATAR/BOARD_THEME/BADGE için hedef id/slug
            $table->unsignedInteger('weight')->default(1);  // ağırlık (weighted random) — > 0
            $table->string('icon', 60)->nullable();         // Phosphor ikon adı
            $table->string('slice_color', 20)->nullable();  // dilim arka plan rengi
            $table->string('text_color', 20)->nullable();   // dilim yazı rengi
            $table->integer('sort')->default(0);            // dilim sırası (drag-drop)
            $table->integer('stock')->nullable();           // toplam stok; null = sınırsız
            $table->unsignedInteger('daily_win_limit')->nullable();       // gün içinde toplam kazanma limiti
            $table->unsignedInteger('per_user_daily_limit')->nullable();  // kullanıcı başına günlük
            $table->unsignedInteger('per_user_lifetime_limit')->nullable(); // kullanıcı başına ömür boyu
            $table->timestamp('starts_at')->nullable();     // kampanya başlangıcı
            $table->timestamp('ends_at')->nullable();       // kampanya bitişi
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('total_won')->default(0); // denormalize: toplam kaç kez çıktı (hızlı istatistik)
            $table->timestamps();

            $table->index(['is_active', 'sort']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lucky_wheel_rewards');
    }
};
