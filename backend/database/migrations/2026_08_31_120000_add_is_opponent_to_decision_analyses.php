<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Zar Ortalamalari (dice averages) icin: karar satirinin RAKIBE mi ait oldugu.
     * Onceden analyzeMatch yalniz insanin (hc) kararlarini saklardi; artik rakip
     * (pvb'de bot) kararlari da saklanir ki zar-basina Sen/Rakip kirilimi ciksin.
     * Hata Gunlugu bu satirlari HARIC tutar (yalniz is_opponent=false gosterir).
     */
    public function up(): void
    {
        Schema::table('decision_analyses', function (Blueprint $table) {
            $table->boolean('is_opponent')->default(false)->after('player');
            // Zar istatistigi sorgusu: user + taraf.
            $table->index(['user_id', 'is_opponent']);
        });
    }

    public function down(): void
    {
        Schema::table('decision_analyses', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'is_opponent']);
            $table->dropColumn('is_opponent');
        });
    }
};
