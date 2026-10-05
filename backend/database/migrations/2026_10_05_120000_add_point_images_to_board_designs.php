<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tavla Tasarımı: özel tahtada tek (1,3,5…) ve çift (2,4,6…) haneler için resim (üçgene kırpılır).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->string('point_image_odd', 255)->nullable()->after('checker_style');
            $table->string('point_image_even', 255)->nullable()->after('point_image_odd');
        });
    }

    public function down(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->dropColumn(['point_image_odd', 'point_image_even']);
        });
    }
};
