<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tavla Tasarımı: hane resmi modu — 'pair' (tek/çift için 2 resim) | 'each' (her haneye ayrı, 24 resim).
// point_images: {"1": "tahta/..png", ..., "24": "..."}; yerleşim point_image_fit içinde "p1".."p24".
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->string('point_mode', 8)->default('pair')->after('checker_style');
            $table->json('point_images')->nullable()->after('point_image_fit');
        });
    }

    public function down(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->dropColumn(['point_mode', 'point_images']);
        });
    }
};
