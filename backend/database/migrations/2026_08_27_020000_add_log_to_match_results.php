<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            // Tam mac analizi (matchLog + insan rengi) JSON. Maca tiklayinca hamle-hamle
            // MatchReport acilir. Buyuk olabilir -> longText.
            $table->longText('log')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn('log');
        });
    }
};
