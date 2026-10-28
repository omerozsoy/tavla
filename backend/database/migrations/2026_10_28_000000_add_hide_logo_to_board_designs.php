<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Özel tavla tasarımında TavlaTV logosunu (orta watermark) gizleme opsiyonu.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->boolean('hide_logo')->default(false)->after('checker_style');
        });
    }

    public function down(): void
    {
        Schema::table('board_designs', function (Blueprint $table) {
            $table->dropColumn('hide_logo');
        });
    }
};
