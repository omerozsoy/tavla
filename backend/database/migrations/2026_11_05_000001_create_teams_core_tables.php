<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Takımlar Ligi — çekirdek tablolar. Turnuva ve "Türkiye Online Tavla Ligi" (league_*)
 * modüllerinden BAĞIMSIZ (team_ öneki). Hiçbir league_/tournament tablosuna FK yok.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('name', 30);
            // Benzersizlik anahtarı: NFC + trim + lowercase (Unicode/büyük-küçük/boşluk duyarsız).
            $table->string('name_key', 60)->unique();
            $table->string('tag', 5);
            $table->string('tag_key', 10)->unique();
            $table->string('logo')->nullable();          // yürürlükteki logo (onaylı/hazır)
            $table->string('logo_pending')->nullable();   // yüklenmiş, admin onayı bekliyor
            $table->string('color1', 9)->default('#A83A2B');
            $table->string('color2', 9)->default('#1f2933');
            $table->string('description', 500)->nullable();
            $table->unsignedBigInteger('founder_id')->index();
            $table->string('status', 16)->default('active'); // active | closed
            $table->boolean('applications_open')->default(true);
            $table->unsignedInteger('min_apply_rating')->nullable();
            // Sıralama için önbellek (liste ekranında per-takım ağır sorgu yapma — §6).
            $table->unsignedInteger('member_count')->default(0);
            $table->double('rating_avg')->default(0);
            $table->unsignedBigInteger('pending_transfer_to')->nullable(); // kuruculuk devri: hedefin açık kabulü bekleniyor
            $table->timestamp('name_changed_at')->nullable(); // 30 gün isim/etiket bekleme
            $table->timestamp('champion_badge_until')->nullable(); // §10 şampiyon rozeti
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->timestamps();
            $table->index(['status', 'rating_avg']);
        });

        Schema::create('team_members', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('team_id')->index();
            // Oyuncu aynı anda TEK takımda — DB düzeyinde garanti (yarış koruması).
            $table->unsignedBigInteger('user_id')->unique();
            $table->string('role', 12)->default('member'); // founder | assistant | member
            $table->unsignedInteger('appointed_seq')->nullable(); // yardımcı atama sırası (devir için)
            $table->timestamp('premium_grace_until')->nullable(); // Premium bitti → 7 günlük yenileme
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->index(['team_id', 'role']);
        });

        // 72 saat bekleme: ayrılan/çıkarılan/Premium nedeniyle düşen oyuncu hiçbir takıma katılamaz.
        Schema::create('team_cooldowns', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->timestamp('until');
            $table->string('reason', 32)->nullable(); // left | kicked | premium_lapsed | team_closed
            $table->timestamp('created_at')->nullable();
            $table->index(['user_id', 'until']);
        });

        // Yönetim işlem günlüğü (kim/ne zaman/ne). Kurucu+yardımcılar kendi takımınınkini görür.
        Schema::create('team_audits', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('team_id')->index();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('action', 48);
            $table->unsignedBigInteger('target_user_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_audits');
        Schema::dropIfExists('team_cooldowns');
        Schema::dropIfExists('team_members');
        Schema::dropIfExists('teams');
    }
};
