<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            // Seviye seçici: arayanın kabul ettiği rakip RATING aralığı. null = sınır yok
            // (o yön serbest). İki yön de depolanır -> eşleşmede KARŞILIKLI kontrol edilir.
            $table->unsignedSmallInteger('min_opp_rating')->nullable()->after('targets');
            $table->unsignedSmallInteger('max_opp_rating')->nullable()->after('min_opp_rating');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['min_opp_rating', 'max_opp_rating']);
        });
    }
};
