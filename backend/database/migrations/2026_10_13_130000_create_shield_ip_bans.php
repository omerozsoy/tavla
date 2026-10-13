<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Güvenlik Kalkanı — IP yasak listesi. Admin bir saldırganın IP'sini buraya ekler;
 * SiteGate middleware'i yasaklı IP'den gelen TÜM /api isteklerini controller'a girmeden
 * 403 ile reddeder. Liste cache'lenir (her istekte DB'ye gidilmez). Admin dönem dönem
 * panelden temizler. Üye yasağı (users.banned_at) ayrıdır; bu salt IP tabanlıdır.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shield_ip_bans', function (Blueprint $table) {
            $table->id();
            $table->string('ip', 45)->unique();
            $table->string('reason', 255)->nullable();     // neden yasaklandı (olay türü / not)
            $table->unsignedBigInteger('created_by')->nullable(); // yasaklayan admin
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shield_ip_bans');
    }
};
