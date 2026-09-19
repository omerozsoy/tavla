<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Güvenlik Kalkanı (Security Shield) tabloları.
 *
 * shield_presence: her istek sahibi (giriş yapmış kullanıcı VEYA misafir IP) için TEK satır,
 *   her /api isteğinde UPSERT edilir -> tablo büyümez (canlı durum: şu an nerede, ne kadardır
 *   sitede, kaç istek, tepe istek/dk, hata/spin sayısı, risk skoru).
 * shield_events: yalnızca DİKKAT ÇEKEN olaylar (istek seli, hata patlaması, şüpheli yol/tarama,
 *   yetkisiz panel denemesi, aşırı çark/slot). Append-only, 14 günde budanır.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shield_presence', function (Blueprint $table) {
            $table->id();
            $table->string('subject', 64)->unique();      // "u:{id}" (üye) veya "ip:{ip}" (misafir)
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('last_path', 191)->nullable();  // en son istek yolu (ne yapıyor)
            $table->string('last_method', 8)->nullable();
            $table->unsignedSmallInteger('last_status')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamp('session_started_at')->nullable(); // bu oturum ne zaman başladı
            $table->unsignedInteger('req_count')->default(0);     // oturumdaki toplam istek
            $table->unsignedInteger('err_count')->default(0);     // 4xx/5xx sayısı
            $table->unsignedInteger('spin_count')->default(0);    // çark+slot çevirme
            $table->unsignedInteger('susp_count')->default(0);    // şüpheli/tarama isteği
            $table->timestamp('win_started_at')->nullable();      // 60sn'lik pencere başı
            $table->unsignedInteger('win_count')->default(0);     // penceredeki istek
            $table->unsignedInteger('rate_max')->default(0);      // görülen tepe istek/dk
            $table->unsignedTinyInteger('rate_tier')->default(0); // 0 normal 1 uyarı 2 tehlike
            $table->unsignedTinyInteger('err_tier')->default(0);
            $table->unsignedTinyInteger('spin_tier')->default(0);
            $table->unsignedSmallInteger('risk')->default(0);     // 0-100 risk skoru
            $table->timestamps();
        });

        Schema::create('shield_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('ip', 45)->nullable()->index();
            $table->string('type', 32)->index();   // rate_burst|error_burst|spin_burst|suspicious_path|admin_probe|banned_hit
            $table->unsignedTinyInteger('severity')->default(1); // 1 bilgi 2 uyarı 3 tehlike
            $table->string('path', 191)->nullable();
            $table->string('method', 8)->nullable();
            $table->unsignedSmallInteger('status')->nullable();
            $table->string('detail', 255)->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shield_events');
        Schema::dropIfExists('shield_presence');
    }
};
