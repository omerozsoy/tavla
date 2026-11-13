<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            // PR ×2 ÖDÜLÜ idempotency + tutar: yalnız KAZANAN satırda yazılır.
            // NULL = henüz değerlendirilmedi, 0 = ödül yok, >0 = verilen ek rating (= orijinal delta).
            $table->integer('pr_rating_bonus')->nullable()->after('delta');
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn('pr_rating_bonus');
        });
    }
};
