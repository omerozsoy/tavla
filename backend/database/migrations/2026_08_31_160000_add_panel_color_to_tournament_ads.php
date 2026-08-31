<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Banner sol panel rengi: elle secilebilir (color picker) + gorselden cikarilan
// baskin renk paleti (palette) hizli-secim swatch'lari icin saklanir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table) {
            $table->string('panel_color', 9)->nullable()->after('meta'); // #rrggbb (bos = varsayilan krem)
            $table->json('palette')->nullable()->after('panel_color');    // gorselden cikan baskin renkler
        });
    }

    public function down(): void
    {
        Schema::table('tournament_ads', function (Blueprint $table) {
            $table->dropColumn(['panel_color', 'palette']);
        });
    }
};
