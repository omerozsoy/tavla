<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tahta tasarimi: (B) tahta zemini resmi — sol/sag yari ayri + seffaflik (renge alternatif,
// ucgenlerin ALTINDA); (A) her haneye opsiyonel metin.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->string('surface_image_left')->nullable()->after('surface');   // sol yari zemin resmi (path)
            $table->string('surface_image_right')->nullable()->after('surface_image_left'); // sag yari zemin resmi
            $table->unsignedTinyInteger('surface_image_opacity')->default(100)->after('surface_image_right'); // %0–100
            $table->json('point_texts')->nullable()->after('point_images'); // {"1".."24": metin}
        });
    }

    public function down(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->dropColumn(['surface_image_left', 'surface_image_right', 'surface_image_opacity', 'point_texts']);
        });
    }
};
