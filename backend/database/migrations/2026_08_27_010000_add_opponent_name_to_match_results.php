<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->string('opponent_name', 40)->nullable()->after('opponent_rating'); // kimle oynandi
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn('opponent_name');
        });
    }
};
