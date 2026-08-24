<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            // Anlasilan mac uzunlugu (eslesme sonrasi kesin). 1 = tek oyun.
            $table->unsignedSmallInteger('target')->nullable()->after('bet_pct');
            // p1'in kabul ettigi uzunluklar (JSON dizi) -> eslesmede kesisim aranir.
            $table->json('targets')->nullable()->after('target');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['target', 'targets']);
        });
    }
};
