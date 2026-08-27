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
            $table->float('opponent_pr')->nullable()->after('opponent_name'); // rakibin bu mactaki PR'i
        });
    }

    public function down(): void
    {
        Schema::table('match_results', function (Blueprint $table) {
            $table->dropColumn(['opponent_name', 'opponent_pr']);
        });
    }
};
