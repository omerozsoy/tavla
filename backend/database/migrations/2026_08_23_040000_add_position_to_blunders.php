<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('blunders', function (Blueprint $table) {
            $table->longText('pos')->nullable()->after('best');    // JSON: hamle oncesi board (GameState)
            $table->longText('steps')->nullable()->after('pos');   // JSON: en iyi hamlenin adimlari (Step[])
            $table->string('player', 8)->nullable()->after('steps'); // 'white' | 'black'
        });
    }

    public function down(): void
    {
        Schema::table('blunders', function (Blueprint $table) {
            $table->dropColumn(['pos', 'steps', 'player']);
        });
    }
};
