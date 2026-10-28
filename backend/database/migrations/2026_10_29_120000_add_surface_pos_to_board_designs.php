<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Zemin resmi KONUM ayarı (x/y/zoom) — sol/sağ yarı AYRI. {l:{x,y,zoom}, r:{x,y,zoom}}.
// cover/contain (surface_image_fit) base'inin üstüne elle konumlandırma.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->json('surface_pos')->nullable()->after('surface_image_fit');
        });
    }

    public function down(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->dropColumn('surface_pos');
        });
    }
};
