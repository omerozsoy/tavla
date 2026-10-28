<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tahta zemin resmi SIĞDIRMA modu: 'cover' = kapla+kırp (eski davranış, varsayılan),
// 'contain' = tüm resim ortada sığsın (büyük resim kırpılmasın). Admin "ortaya oturtamıyorum" sorunu.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->string('surface_image_fit', 16)->default('cover')->after('surface_image_opacity');
        });
    }

    public function down(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->dropColumn('surface_image_fit');
        });
    }
};
