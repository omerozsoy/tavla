<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->unsignedSmallInteger('match_length')->nullable()->after('delta'); // hedef puan (1..25)
            $table->float('pr')->nullable()->after('match_length');                    // bu macin PR'i (dusuk=iyi)
            $table->unsignedBigInteger('coins_after')->nullable()->after('pr');         // mac sonrasi bakiye
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['match_length', 'pr', 'coins_after']);
        });
    }
};
