<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HOŞGELDİN coin idempotent anahtarı: welcome_granted true olduysa bonus VERİLDİ (tekrar verilmez).
 * Bonus yalnız e-posta DOĞRULAYAN veya Google ile giren (doğrulanmış) kullanıcıya verilir — kayıt
 * anında DEĞİL (sahte e-posta ile bonus farmlanmasın). Mevcut kullanıcılar false (retroaktif yok;
 * yalnız yeni doğrulama geçişlerinde verilir).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('welcome_granted')->default(false)->after('coins_reserved');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('welcome_granted');
        });
    }
};
