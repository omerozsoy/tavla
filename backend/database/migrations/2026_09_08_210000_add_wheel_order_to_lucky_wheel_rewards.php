<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Çark dilim düzeni için ayrı sıra alanı. `sort` = admin tablo/liste sırası (sürükle-bırak,
 * SABİT). `wheel_order` = çark üzerindeki dilim dizilişi; yalnız "Çarkı Karıştır" düğmesiyle
 * değişir, admin listesini etkilemez. Null = henüz karıştırılmadı -> çark `sort`'a düşer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lucky_wheel_rewards', function (Blueprint $table) {
            $table->integer('wheel_order')->nullable()->after('sort');
        });
    }

    public function down(): void
    {
        Schema::table('lucky_wheel_rewards', function (Blueprint $table) {
            $table->dropColumn('wheel_order');
        });
    }
};
