<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tavla Tasarımı: hane resminin üçgen içindeki yerleşimi (yatay/dikey konum %, yakınlaştırma %, en-boy oranı).
// {"odd": {"x":50,"y":50,"zoom":100,"aspect":0.33}, "even": {...}}
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->json('point_image_fit')->nullable()->after('point_image_even');
        });
    }

    public function down(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->dropColumn('point_image_fit');
        });
    }
};
